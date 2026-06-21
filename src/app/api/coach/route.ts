import { z } from "zod";
import type { Activity, Category } from "@core/schemas";
import type { AiCoachContext, AiPort, AuthPort, DataPort } from "@core/ports";
import { FactorRepository } from "@core/factors/repository";
import { roundForDisplay } from "@core/units/index";
import {
  deriveReductionInsights,
  type ReductionCandidate,
} from "@core/insights";
import {
  assertAiInputWithinCap,
  capAiInput,
  enforceRateLimit,
  jsonResponse,
  rateLimitKey,
  readJsonBody,
  requireIdentity,
  reserveAiCall,
  toErrorResponse,
  TokenBucketRateLimiter,
  tryValidateAiOutput,
} from "@/server/http";
import { createContainer } from "@/server/container";

/**
 * POST /api/coach. The conversational coach. Composes the SAME
 * shared guards the parse/insights routes use, in order:
 *   requireIdentity -> enforceRateLimit -> assertAiInputWithinCap(message)
 *   -> reserveAiCall (the SAME persisted daily AI quota as parse/insights)
 *   -> build grounded `context` from the user's own calculator data
 *   -> AiPort.coach(...) -> tryValidateAiOutput (Zod: non-empty + DIGIT-FREE).
 *
 * HARD RULE (ADR-001): the AI `reply` is DIGIT-FREE — the model never emits a
 * number. Every factual figure in `grounding` is CALCULATOR-computed (summed
 * from each activity's persisted `co2eKg`, which the calculator produced at log
 * time, and from `deriveReductionInsights`). The UI shows the `grounding`
 * numbers; the `reply` carries advice text only.
 *
 * Injection safety: the user's `message` AND their previously-logged free text
 * are treated as DATA, never instructions (second-order-injection-safe). The
 * model only ever receives the calculator-derived grounding + the bounded
 * message, and the reply is re-validated digit-free before it leaves the route.
 *
 * Degrade, never block: on ANY failure (AI unavailable, off-policy reply
 * with a digit, validation miss, or quota exhausted) the route returns a 200
 * with a NEUTRAL, digit-free advice fallback and `fallback: true` — never a 500,
 * never a number from the model. The `grounding` numbers are still returned so
 * the UI keeps its calculator-sourced figures.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The coach reply must be a non-empty string with NO digits — advice text only,
 * never a number. Reuses the EXACT digit-free refine the insights route applies
 * to AI phrasing; the calculator is the sole producer of numbers (ADR-001).
 */
export const coachReplySchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((s) => !/\d/.test(s), "Coach reply must not contain a number.");

/** Neutral, digit-free advice used whenever the AI path cannot be trusted. */
export const NEUTRAL_COACH_REPLY =
  "A reliable next step is to focus on the category that shows up most in your log and make a small, repeatable swap there. Steady changes tend to add up faster than big one-off efforts.";

export const coachInputSchema = z
  .object({
    message: z.string().min(1),
    locale: z.string().min(1).max(40).optional(),
    timeZone: z.string().min(1).max(64).optional(),
  })
  .strict();
export type CoachInput = z.infer<typeof coachInputSchema>;

export type CoachFallbackReason =
  | "quota_exceeded"
  | "ai_unavailable"
  | "invalid_ai_output";

/**
 * Calculator-sourced grounding the UI displays. Every number here traces to the
 * calculator (summed persisted `co2eKg` + ranked insight savings), NEVER to the
 * model. `topInsightTitles` is the deterministic title text (no AI).
 */
export interface CoachGrounding {
  totalKg: number;
  topCategory: Category | null;
  topInsightTitles: string[];
  activityCount: number;
}

export interface CoachResponse {
  reply: string;
  fallback: boolean;
  reason?: CoachFallbackReason;
  grounding: CoachGrounding;
}

export interface CoachDeps {
  auth: AuthPort;
  data: DataPort;
  repository: FactorRepository;
  ai?: AiPort;
  limiter?: TokenBucketRateLimiter;
}

// One process-wide fast-path limiter, mirroring parse/insights. The
// persisted daily quota in the DataPort is the multi-instance correctness floor.
const sharedLimiter = new TokenBucketRateLimiter({
  capacity: 20,
  refillPerSecond: 1,
});

async function resolveDeps(): Promise<CoachDeps> {
  const { auth, data, ai } = await createContainer();
  return {
    auth,
    data,
    ai,
    repository: FactorRepository.fromSeed(),
    limiter: sharedLimiter,
  };
}

/**
 * Build the candidate reductions for grounding, mirroring the insights route:
 * the current leg is the user's own logged activity and the alternative is a
 * lower-carbon swap from the SAME factor vocabulary, so BOTH legs are priced by
 * the calculator — this never invents a number.
 */
function candidatesFromActivities(
  activities: readonly Activity[],
): ReductionCandidate[] {
  const candidates: ReductionCandidate[] = [];
  for (const a of activities) {
    if (a.factorKey === "diet.meal.beef") {
      candidates.push({
        id: `swap-beef-veg:${a.id}`,
        title: "Swap a beef meal for a vegetarian one",
        current: {
          candidateFactorKey: "diet.meal.beef",
          value: a.quantity,
          unit: a.unit,
        },
        alternative: {
          candidateFactorKey: "diet.meal.vegetarian",
          value: a.quantity,
          unit: a.unit,
        },
      });
    }
    if (a.factorKey === "diet.meal.chicken") {
      candidates.push({
        id: `swap-chicken-veg:${a.id}`,
        title: "Swap a chicken meal for a vegetarian one",
        current: {
          candidateFactorKey: "diet.meal.chicken",
          value: a.quantity,
          unit: a.unit,
        },
        alternative: {
          candidateFactorKey: "diet.meal.vegetarian",
          value: a.quantity,
          unit: a.unit,
        },
      });
    }
  }
  return candidates;
}

/**
 * Derive the calculator-sourced grounding from the user's activities. EVERY
 * number here comes from the calculator: `totalKg` sums the persisted per-item
 * `co2eKg` (calculator-produced at log time), `topCategory` is the category with
 * the largest such sum, and `topInsightTitles` are the deterministic titles of
 * the top-3 ranked reductions (the saving numbers themselves come from
 * {@link deriveReductionInsights} and are NOT exposed to the model).
 */
export function buildGrounding(
  repository: FactorRepository,
  activities: readonly Activity[],
): CoachGrounding {
  let totalKg = 0;
  const byCategory = new Map<Category, number>();
  for (const a of activities) {
    totalKg += a.co2eKg;
    byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + a.co2eKg);
  }

  let topCategory: Category | null = null;
  let topSum = -Infinity;
  for (const [category, sum] of byCategory) {
    // Deterministic tie-break by category name keeps the output stable.
    if (
      sum > topSum ||
      (sum === topSum && (topCategory === null || category < topCategory))
    ) {
      topSum = sum;
      topCategory = category;
    }
  }

  const { insights } = deriveReductionInsights(
    repository,
    candidatesFromActivities(activities),
  );
  const topInsightTitles = insights.slice(0, 3).map((i) => i.title);

  return {
    totalKg: roundForDisplay(totalKg),
    topCategory,
    topInsightTitles,
    activityCount: activities.length,
  };
}

/** Map the calculator grounding into the digit-bearing AI coach context. */
export function toAiContext(grounding: CoachGrounding): AiCoachContext {
  return {
    totalKgToDate: grounding.totalKg,
    ...(grounding.topCategory !== null && {
      topCategory: grounding.topCategory,
    }),
    ...(grounding.topInsightTitles.length > 0 && {
      topInsightTitles: grounding.topInsightTitles,
    }),
  };
}

function respond(
  reply: string,
  grounding: CoachGrounding,
  fallbackReason?: CoachFallbackReason,
): Response {
  const body: CoachResponse = {
    reply,
    fallback: fallbackReason !== undefined,
    ...(fallbackReason !== undefined && { reason: fallbackReason }),
    grounding,
  };
  return jsonResponse(200, body);
}

/**
 * Injectable handler core (testable without the Next.js runtime). The thin
 * `POST` export below wires it to the real container.
 */
export async function handleCoach(
  req: Request,
  deps: CoachDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    if (deps.limiter) {
      enforceRateLimit(deps.limiter, rateLimitKey(req, identity.uid));
    }

    const body = await readJsonBody(req, coachInputSchema);
    // Hard AI-input cap on the message BEFORE any model call: an over-cap
    // message is a 413, never an AI cost.
    assertAiInputWithinCap(body.message);

    // Grounding is computed from the user's OWN calculator data and is returned
    // regardless of whether the AI path succeeds — the UI keeps its numbers.
    const activities = await deps.data.listActivities(identity.uid, {
      limit: 200,
    });
    const grounding = buildGrounding(deps.repository, activities);

    // No AI port wired (or quota exhausted, or failure): non-blocking neutral
    // advice. Never a 500, never a number from the model.
    if (!deps.ai) {
      return respond(NEUTRAL_COACH_REPLY, grounding, "ai_unavailable");
    }

    const quota = await reserveAiCall(deps.data, identity.uid, {
      ...(body.timeZone !== undefined && { timeZone: body.timeZone }),
    });
    if (!quota.allowed) {
      return respond(NEUTRAL_COACH_REPLY, grounding, "quota_exceeded");
    }

    // The user's message is DATA and capped to the shared AI-input limit so token
    // cost is bounded. The grounding numbers are the only facts handed to the
    // model; the model is instructed never to restate them.
    let raw: unknown;
    try {
      raw = await deps.ai.coach({
        message: capAiInput(body.message),
        context: toAiContext(grounding),
        ...(body.locale !== undefined && { locale: body.locale }),
      });
    } catch {
      return respond(NEUTRAL_COACH_REPLY, grounding, "ai_unavailable");
    }

    // The reply is Zod-validated non-empty + DIGIT-FREE. A planted digit (a
    // model that ignored the no-number rule, e.g. via a second-order injection in
    // a logged string) fails here and degrades to neutral advice — no model
    // number ever reaches the UI.
    const validated = tryValidateAiOutput(raw, coachReplySchema);
    if (!validated.ok) {
      return respond(NEUTRAL_COACH_REPLY, grounding, "invalid_ai_output");
    }

    return respond(validated.data, grounding);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  return handleCoach(req, await resolveDeps());
}
