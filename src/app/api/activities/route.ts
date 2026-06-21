import { z } from "zod";
import {
  activityOriginSchema,
  categorySchema,
  unitSchema,
  MAX_QUANTITY,
  type Activity,
  type ActivityOrigin,
} from "@core/schemas";
import type { AuthPort, DataPort } from "@core/ports";
import { FactorRepository } from "@core/factors/repository";
import {
  calculateItem,
  type CalcItemInput,
  type CalcResolved,
} from "@core/calculator";
import {
  previewWithRepository,
  type PreviewResult,
} from "@core/calculator/preview";
import { createContainer } from "@/server/container";
import {
  jsonResponse,
  readJsonBody,
  requireIdentity,
  toErrorResponse,
  validateInput,
  errors,
} from "@/server/http";

/**
 * POST/GET /api/activities.
 *
 *  - POST: authz -> Zod input -> compute CO2e via the PURE calculator (the SOLE
 *    producer of emission numbers, ADR-001) -> persist via DataPort. Free-text
 *    fields are sanitized/escaped on store. A partial-resolve set (one item
 *    has an unsourced/unknown key) totals only the sourced items and persists
 *    them; the unsourced items are EXCLUDED and reported as partial.
 *  - POST ?preview=1: same authz + size cap, but computes + returns the breakdown
 *    via the preview module with ZERO DataPort writes ("show before save").
 *    No AI call, no persistence.
 *  - GET: list for the dashboard via shaped (category,ts)/(ts) queries. The in-mem
 *    local adapter needs no indexes; the (category,ts)/(ts) composite indexes are
 *    a GCP-only deploy artifact validated at deploy time.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ACTIVITY_LEN = 200;

export const activityItemSchema = z
  .object({
    category: categorySchema,
    activity: z.string().min(1).max(MAX_ACTIVITY_LEN),
    // Mirror the AI-parse / domain bounds: a directly-POSTed non-positive or
    // over-max value is a clean 400, not silently swallowed into "unsourced".
    value: z.number().finite().positive().max(MAX_QUANTITY),
    unit: unitSchema,
    candidateFactorKey: z.string().min(1).max(120),
  })
  .strict();
export type ActivityItemInput = z.infer<typeof activityItemSchema>;

export const logActivitiesSchema = z
  .object({
    items: z.array(activityItemSchema).min(1).max(50),
    locale: z.enum(["UK", "US"]).optional(),
    factorSet: z.enum(["EPA", "DEFRA_DESNZ"]).optional(),
    origin: activityOriginSchema.optional(),
  })
  .strict();
export type LogActivitiesInput = z.infer<typeof logActivitiesSchema>;

export const listQuerySchema = z
  .object({
    category: categorySchema.optional(),
    sinceTs: z.coerce.number().int().nonnegative().optional(),
    untilTs: z.coerce.number().int().nonnegative().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .strict();

export interface PersistedItemSummary {
  id: string;
  category: Activity["category"];
  activity: string;
  co2eKg: number;
}

export interface UnsourcedItemSummary {
  activity: string;
  candidateFactorKey: unknown;
  reason: string;
}

export interface LogActivitiesResponse {
  persisted: PersistedItemSummary[];
  unsourced: UnsourcedItemSummary[];
  totalKg: number;
  partial: boolean;
}

export interface ActivitiesDeps {
  auth: AuthPort;
  data: DataPort;
  repository: FactorRepository;
  now?: () => number;
  newId?: () => string;
}

async function resolveDeps(): Promise<ActivitiesDeps> {
  const { auth, data } = await createContainer();
  return { auth, data, repository: FactorRepository.fromSeed() };
}

/**
 * Escape HTML-significant characters in user free text BEFORE it is stored, so a
 * second-order XSS / injection payload cannot be persisted and later rendered or
 * re-fed live. Input is treated as DATA, never markup or instructions.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .trim();
}

function toCalcInput(item: ActivityItemInput): CalcItemInput {
  return {
    candidateFactorKey: item.candidateFactorKey,
    value: item.value,
    unit: item.unit,
    activity: item.activity,
  };
}

function defaultNewId(now: number, index: number): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `act-${now.toString(36)}-${index.toString(36)}-${rand}`;
}

/**
 * The SOLE mapping from a `resolved` calculator result to a persisted `Activity`.
 * Both the live logging path (above) and the dev sample-seed route reuse this, so
 * a stored sample row is byte-for-byte the same SHAPE as a real one — and, like a
 * real one, carries the CO2e the calculator produced (ADR-001): NOTHING here ever
 * invents or rounds an emission number. The caller supplies only the row id, the
 * timestamp, the sanitized free-text label, and the origin; every emission-bearing
 * field (`co2eKg`, `factorKey`, `factorSet`, `source`, …) comes from `result`.
 */
export function activityFromResolved(
  result: CalcResolved,
  args: { id: string; ts: number; activity: string; origin: ActivityOrigin },
): Activity {
  return {
    id: args.id,
    ts: args.ts,
    category: result.category,
    activity: args.activity,
    quantity: result.inputValue,
    unit: result.inputUnit,
    factorKey: result.candidateFactorKey,
    factorSet: result.factorSet,
    factorSetVersion: result.factorSetVersion,
    co2eKg: result.co2eKg,
    source: result.source,
    origin: args.origin,
  };
}

async function handleLog(
  req: Request,
  deps: ActivitiesDeps,
  uid: string,
): Promise<Response> {
  const body = await readJsonBody(req, logActivitiesSchema);
  const now = (deps.now ?? Date.now)();
  const preference = {
    ...(body.locale !== undefined && { locale: body.locale }),
    ...(body.factorSet !== undefined && { factorSet: body.factorSet }),
  };
  const origin = body.origin ?? "nl";

  const persisted: PersistedItemSummary[] = [];
  const unsourced: UnsourcedItemSummary[] = [];
  let totalKg = 0;

  let index = 0;
  for (const item of body.items) {
    const result = calculateItem(
      deps.repository,
      toCalcInput(item),
      preference,
    );
    if (result.status === "fallback") {
      unsourced.push({
        activity: sanitizeText(item.activity),
        candidateFactorKey: item.candidateFactorKey,
        reason: result.reason,
      });
      index += 1;
      continue;
    }

    const id = deps.newId ? deps.newId() : defaultNewId(now, index);
    const activity = activityFromResolved(result, {
      id,
      ts: now,
      activity: sanitizeText(item.activity),
      origin,
    });
    await deps.data.addActivity(uid, activity);
    persisted.push({
      id: activity.id,
      category: activity.category,
      activity: activity.activity,
      co2eKg: activity.co2eKg,
    });
    totalKg += activity.co2eKg;
    index += 1;
  }

  const responseBody: LogActivitiesResponse = {
    persisted,
    unsourced,
    totalKg,
    partial: unsourced.length > 0,
  };
  return jsonResponse(201, responseBody);
}

async function handlePreview(
  req: Request,
  deps: ActivitiesDeps,
): Promise<Response> {
  // Preview STILL passes authz + the input/size cap (done by the caller); it just
  // makes NO AI call and NO DataPort writes.
  const body = await readJsonBody(req, logActivitiesSchema);
  const preference = {
    ...(body.locale !== undefined && { locale: body.locale }),
    ...(body.factorSet !== undefined && { factorSet: body.factorSet }),
  };
  const preview: PreviewResult = previewWithRepository(
    deps.repository,
    body.items.map(toCalcInput),
    preference,
  );
  return jsonResponse(200, { preview });
}

export async function handlePost(
  req: Request,
  deps: ActivitiesDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const url = new URL(req.url);
    if (url.searchParams.get("preview") === "1") {
      return await handlePreview(req, deps);
    }
    return await handleLog(req, deps, identity.uid);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function handleGet(
  req: Request,
  deps: ActivitiesDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const query = validateInput(params, listQuerySchema);
    if (
      query.sinceTs !== undefined &&
      query.untilTs !== undefined &&
      query.sinceTs > query.untilTs
    ) {
      throw errors.invalidInput("sinceTs must not be after untilTs.");
    }
    const activities = await deps.data.listActivities(identity.uid, query);
    return jsonResponse(200, { activities });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  return handlePost(req, await resolveDeps());
}

export async function GET(req: Request): Promise<Response> {
  return handleGet(req, await resolveDeps());
}
