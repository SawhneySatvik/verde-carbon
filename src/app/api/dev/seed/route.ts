import { z } from "zod";
import type { Activity, Goal } from "@core/schemas";
import type { AuthPort, BatchOp, DataPort } from "@core/ports";
import { FactorRepository } from "@core/factors/repository";
import { calculateItem, type CalcItemInput } from "@core/calculator";
import { activityFromResolved, sanitizeText } from "@/app/api/activities/route";
import { createContainer } from "@/server/container";
import {
  jsonResponse,
  readJsonBody,
  requireIdentity,
  toErrorResponse,
} from "@/server/http";
import { isSampleId, SAMPLE_GOAL_ID, SAMPLE_ID_PREFIX } from "./sampleTag";

export { SAMPLE_GOAL_ID, SAMPLE_ID_PREFIX } from "./sampleTag";

/**
 * POST/DELETE /api/dev/seed — the "Load sample data" demo affordance.
 *
 * A tasteful demo seam so the dashboard / insights / charts can be SEEN populated
 * without hand-logging ~20 activities. It is grounded by construction:
 *
 *   - Every sample row's CO2e is COMPUTED by the SAME pure calculator the live
 *     `/api/activities` POST uses (`calculateItem`) from a REAL seeded
 *     `candidateFactorKey` + a realistic quantity. No emission number is ever
 *     fabricated, hardcoded, or rounded here (ADR-001) — this route only chooses
 *     the inputs; the calculator is the sole producer of the kilograms, exactly as
 *     for a real log. The persisted shape is built by the shared
 *     `activityFromResolved` mapping, so a sample row is byte-for-byte the same
 *     shape as a real one.
 *   - The quantities are picked so each item resolves (known key, compatible unit,
 *     in-bounds value); a never-resolving spec is a server bug, not a silent zero.
 *
 * Authz: composes `requireIdentity` first, so it only ever writes the
 * authenticated anon caller's OWN account (their data), keyed off a verified uid.
 *
 * Idempotent-ish: every sample row id is `sample-…`-prefixed and the seeded goal
 * id is fixed, so POST clears any prior sample data first (clear-then-seed) and
 * DELETE removes ONLY sample rows + the sample goal — a user's real logs are never
 * touched. POST also accepts `{ clear: true }` as an alias for the DELETE clear.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// An empty body ("Load sample data" sends no JSON) is valid: a missing body
// preprocesses to `{}`. `{ clear: true }` is the in-band clear alias.
export const seedBodySchema = z.preprocess(
  (value) => (value === undefined || value === null ? {} : value),
  z.object({ clear: z.boolean().optional() }).strict(),
);
export type SeedBody = z.infer<typeof seedBodySchema>;

/**
 * The sample plan. Each entry is a calculator INPUT (a real factor key + a
 * realistic quantity) plus a `daysAgo` backdate so the trend chart has shape over
 * the past ~3–4 weeks. We deliberately do NOT list a CO2e — the calculator derives
 * it. US/EPA imperial units (gallon, passenger-mile, kWh, therm, meal) keep the
 * quantities intuitive.
 */
interface SampleSpec {
  category: Activity["category"];
  activity: string;
  value: number;
  unit: CalcItemInput["unit"];
  candidateFactorKey: string;
  daysAgo: number;
}

export const SAMPLE_SPECS: readonly SampleSpec[] = [
  // ── transport ──
  { category: "transport", activity: "Commute by car", value: 9, unit: "gallon", candidateFactorKey: "transport.car.gasoline", daysAgo: 26 }, // prettier-ignore
  { category: "transport", activity: "Weekend road trip", value: 14, unit: "gallon", candidateFactorKey: "transport.car.gasoline", daysAgo: 21 }, // prettier-ignore
  { category: "transport", activity: "Flight to a conference", value: 1100, unit: "passenger-mile", candidateFactorKey: "transport.air.medium", daysAgo: 19 }, // prettier-ignore
  { category: "transport", activity: "Diesel rental car", value: 7, unit: "gallon", candidateFactorKey: "transport.car.diesel", daysAgo: 12 }, // prettier-ignore
  { category: "transport", activity: "Commute by car", value: 8, unit: "gallon", candidateFactorKey: "transport.car.gasoline", daysAgo: 5 }, // prettier-ignore
  // ── home energy ──
  { category: "energy", activity: "Home electricity", value: 210, unit: "kWh", candidateFactorKey: "energy.electricity.grid", daysAgo: 24 }, // prettier-ignore
  { category: "energy", activity: "Natural gas heating", value: 18, unit: "therm", candidateFactorKey: "energy.naturalgas.home", daysAgo: 17 }, // prettier-ignore
  { category: "energy", activity: "Home electricity", value: 185, unit: "kWh", candidateFactorKey: "energy.electricity.grid", daysAgo: 10 }, // prettier-ignore
  { category: "energy", activity: "Natural gas heating", value: 12, unit: "therm", candidateFactorKey: "energy.naturalgas.home", daysAgo: 3 }, // prettier-ignore
  // ── diet ──
  { category: "diet", activity: "Beef dinner", value: 3, unit: "meal", candidateFactorKey: "diet.meal.beef", daysAgo: 25 }, // prettier-ignore
  { category: "diet", activity: "Chicken lunches", value: 5, unit: "meal", candidateFactorKey: "diet.meal.chicken", daysAgo: 22 }, // prettier-ignore
  { category: "diet", activity: "Vegetarian meals", value: 8, unit: "meal", candidateFactorKey: "diet.meal.vegetarian", daysAgo: 15 }, // prettier-ignore
  { category: "diet", activity: "Beef dinner", value: 2, unit: "meal", candidateFactorKey: "diet.meal.beef", daysAgo: 11 }, // prettier-ignore
  { category: "diet", activity: "Chicken dinner", value: 4, unit: "meal", candidateFactorKey: "diet.meal.chicken", daysAgo: 7 }, // prettier-ignore
  { category: "diet", activity: "Vegetarian meals", value: 6, unit: "meal", candidateFactorKey: "diet.meal.vegetarian", daysAgo: 2 }, // prettier-ignore
  { category: "diet", activity: "Vegetarian meals", value: 4, unit: "meal", candidateFactorKey: "diet.meal.vegetarian", daysAgo: 1 }, // prettier-ignore
];

const DAY_MS = 86_400_000;

export interface SeedDeps {
  auth: AuthPort;
  data: DataPort;
  repository: FactorRepository;
  now?: () => number;
}

async function resolveDeps(): Promise<SeedDeps> {
  const { auth, data } = await createContainer();
  return { auth, data, repository: FactorRepository.fromSeed() };
}

/**
 * Build the persisted sample Activities from {@link SAMPLE_SPECS} via the SAME
 * calculator path real logging uses. Every emission number comes from
 * `calculateItem` — a spec that does not resolve is a bug (we surface it), never a
 * fabricated/zero CO2e. Backdated `ts` spreads the rows across the past weeks.
 */
export function buildSampleActivities(
  repository: FactorRepository,
  now: number,
): Activity[] {
  // US/EPA imperial — matches the intuitive units chosen in the specs.
  const preference = { locale: "US" as const };
  const out: Activity[] = [];
  SAMPLE_SPECS.forEach((spec, index) => {
    const result = calculateItem(
      repository,
      {
        candidateFactorKey: spec.candidateFactorKey,
        value: spec.value,
        unit: spec.unit,
        activity: spec.activity,
      },
      preference,
    );
    if (result.status !== "resolved") {
      // A non-resolving sample spec is a server-side error, NOT a silent zero —
      // we never persist a fabricated number to fill the gap.
      throw new Error(
        `Sample spec "${spec.candidateFactorKey}" did not resolve via the calculator (${result.reason}).`,
      );
    }
    out.push(
      activityFromResolved(result, {
        id: `${SAMPLE_ID_PREFIX}${index.toString().padStart(2, "0")}-${spec.candidateFactorKey}`,
        ts: now - spec.daysAgo * DAY_MS,
        activity: sanitizeText(spec.activity),
        origin: "baseline",
      }),
    );
  });
  return out;
}

/** A reduction goal whose baseline is the computed sample total (no magic number). */
function buildSampleGoal(activities: readonly Activity[], now: number): Goal {
  const baselineKg = activities.reduce((sum, a) => sum + a.co2eKg, 0);
  return {
    id: SAMPLE_GOAL_ID,
    type: "reduction",
    targetPct: 15,
    baselineKg,
    period: "monthly",
    createdAt: now,
    active: true,
  };
}

/** Remove only sample-tagged activities + the sample goal. Returns the count. */
async function clearSampleData(
  deps: SeedDeps,
  uid: string,
): Promise<{ removedActivities: number; removedGoal: boolean }> {
  const existing = await deps.data.listActivities(uid);
  const sampleIds = existing.filter((a) => isSampleId(a.id)).map((a) => a.id);
  const goals = await deps.data.listGoals(uid);
  const hasSampleGoal = goals.some((g) => g.id === SAMPLE_GOAL_ID);

  const ops: BatchOp[] = sampleIds.map((id) => ({
    kind: "delete",
    collection: "activities",
    id,
  }));
  if (hasSampleGoal) {
    ops.push({ kind: "delete", collection: "goals", id: SAMPLE_GOAL_ID });
  }
  if (ops.length > 0) {
    await deps.data.runBatch({
      uid,
      ops,
      idempotencyKey: `sample-clear-${uid}-${Date.now()}`,
    });
  }
  return { removedActivities: sampleIds.length, removedGoal: hasSampleGoal };
}

export interface SeedResponse {
  seeded: number;
  goalSeeded: boolean;
  totalKg: number;
}

async function handleSeed(deps: SeedDeps, uid: string): Promise<Response> {
  // Clear-then-seed keeps a repeat "Load sample data" idempotent.
  await clearSampleData(deps, uid);

  const now = (deps.now ?? Date.now)();
  const activities = buildSampleActivities(deps.repository, now);
  for (const activity of activities) {
    await deps.data.addActivity(uid, activity);
  }
  const goal = buildSampleGoal(activities, now);
  await deps.data.setGoal(uid, goal);

  const totalKg = activities.reduce((sum, a) => sum + a.co2eKg, 0);
  const body: SeedResponse = {
    seeded: activities.length,
    goalSeeded: true,
    totalKg,
  };
  return jsonResponse(201, body);
}

export async function handlePost(
  req: Request,
  deps: SeedDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const body = await readJsonBody(req, seedBodySchema);
    if (body.clear === true) {
      const removed = await clearSampleData(deps, identity.uid);
      return jsonResponse(200, { cleared: true, ...removed });
    }
    return await handleSeed(deps, identity.uid);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function handleDelete(
  req: Request,
  deps: SeedDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const removed = await clearSampleData(deps, identity.uid);
    return jsonResponse(200, { cleared: true, ...removed });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  return handlePost(req, await resolveDeps());
}

export async function DELETE(req: Request): Promise<Response> {
  return handleDelete(req, await resolveDeps());
}
