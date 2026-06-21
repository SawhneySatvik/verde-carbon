import { z } from "zod";
import type { Activity } from "@core/schemas";
import type { AiPort, AuthPort, DataPort } from "@core/ports";
import { FactorRepository } from "@core/factors/repository";
import {
  deriveReductionInsights,
  type ReductionCandidate,
  type ReductionInsight,
} from "@core/insights";
import {
  capAiInput,
  jsonResponse,
  rateLimitKey,
  requireIdentity,
  reserveAiCall,
  toErrorResponse,
  validateInput,
  TokenBucketRateLimiter,
} from "@/server/http";
import { createContainer } from "@/server/container";

/**
 * Cap on how many insights may be AI-phrased per request. The route reserves ONE
 * persisted-quota unit per phraser call (up to this cap) and degrades the rest to
 * neutral, so the AI-call count NEVER exceeds the quota reserved — a fan-out
 * of N insights can no longer hide under a single reservation.
 */
export const MAX_AI_PHRASED_INSIGHTS = 3;

/**
 * GET /api/insights. Ranked reduction insights derived by the PURE
 * core/insights module — every quantified saving comes ONLY from the calculator
 * (ADR-001), never the model.
 *
 * AI phrasing is OPTIONAL: an injected phraser may reword the neutral text, but
 * its output is Zod-validated to be a SHORT, non-numeric string and degrades to
 * the deterministic neutral phrasing on any AI failure or validation miss. The
 * model can never inject a number or an instruction into the response.
 *
 * This is the most expensive endpoint (lists up to 200 activities, can call
 * the phraser per insight), so the SAME guards the parse route uses gate the AI
 * work: the in-memory token bucket (fast path) AND the persisted per-anon-uid
 * daily quota (multi-instance floor). Crucially these only gate the OPTIONAL
 * AI phrasing — when exhausted the endpoint still returns the ranked,
 * calculator-sourced insights with NEUTRAL phrasing. Degrade, never block.
 *
 * Cost integrity: the phraser is only ever invoked for the top
 * MAX_AI_PHRASED_INSIGHTS, and ONE persisted-quota unit is reserved per phraser
 * call — so the number of model calls never exceeds the quota reserved. Once the
 * daily quota is exhausted mid-list, the remaining insights degrade to neutral.
 * The quota day rolls over at the USER time zone (threaded from the GET query,
 * like parse), so quota-day == streak-day.
 *
 * The joined free text of up to 200 activities (~40KB) is capped to
 * MAX_AI_INPUT_CHARS before reaching the phraser, bounding token cost.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** AI phrasing must be a short string with NO digits — text only, never a number. */
export const aiPhraseSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => !/\d/.test(s), "Phrasing must not contain a number.");

/**
 * GET query. `timeZone` defines the daily AI-quota rollover boundary (IANA), read
 * from the query exactly like the parse route so the quota day matches the streak
 * day; absent it defaults to UTC.
 */
export const insightsQuerySchema = z
  .object({
    timeZone: z.string().min(1).max(64).optional(),
  })
  .strict();

/**
 * Build reduction candidates from the user's logged activities. The current leg
 * is the user's own activity; the alternative is a lower-carbon swap from the
 * SAME factor vocabulary, so BOTH legs are priced by the calculator.
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

export interface InsightsDeps {
  auth: AuthPort;
  data: DataPort;
  repository: FactorRepository;
  ai?: AiPort;
  limiter?: TokenBucketRateLimiter;
}

/** A ranked insight with its final (AI or neutral) phrasing resolved. */
export type PhrasedInsight = ReductionInsight;

// One process-wide fast-path limiter, mirroring the parse route. The
// persisted daily quota is the multi-instance correctness floor.
const sharedLimiter = new TokenBucketRateLimiter({
  capacity: 20,
  refillPerSecond: 1,
});

async function resolveDeps(): Promise<InsightsDeps> {
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
 * Fast-path gate for OPTIONAL AI phrasing: the AI port must exist and the per-uid
 * token bucket (if any) must yield a token. This bounds the request burst; the
 * PER-CALL persisted quota reservation (see {@link handleGet}) is the actual cost
 * floor. A miss means phrasing degrades to the deterministic neutral text.
 */
function aiPhrasingFastPathAllowed(
  req: Request,
  deps: InsightsDeps,
  uid: string,
): boolean {
  if (!deps.ai) {
    return false;
  }
  if (deps.limiter) {
    return deps.limiter.consume(rateLimitKey(req, uid)).allowed;
  }
  return true;
}

/**
 * Resolve AI phrasing for a single insight title, treating the previously-logged
 * free text as DATA. Returns Zod-validated neutral-fallback text — never a number,
 * never executed instructions (second-order injection defense).
 */
export async function phraseWithAi(
  ai: AiPort | undefined,
  title: string,
  projectedKgSavedDisplay: number,
  context: string,
): Promise<string> {
  const neutral = `${title} could save about ${projectedKgSavedDisplay} kg CO2e.`;
  if (!ai) {
    return neutral;
  }
  let raw: unknown;
  try {
    raw = await ai.phraseInsight({ action: title, context });
  } catch {
    return neutral;
  }
  const parsed = aiPhraseSchema.safeParse(raw);
  if (!parsed.success) {
    return neutral;
  }
  // The AI supplies only the lead-in TEXT; the number is appended from the
  // calculator-derived value, so the quantified impact is never AI-originated.
  return `${parsed.data} It could save about ${projectedKgSavedDisplay} kg CO2e.`;
}

export async function handleGet(
  req: Request,
  deps: InsightsDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const url = new URL(req.url);
    const { timeZone } = validateInput(
      Object.fromEntries(url.searchParams.entries()),
      insightsQuerySchema,
    );
    const activities = await deps.data.listActivities(identity.uid, {
      limit: 200,
    });
    const candidates = candidatesFromActivities(activities);
    const { insights, skipped } = deriveReductionInsights(
      deps.repository,
      candidates,
    );

    // Fast-path burst gate; the per-call persisted quota below is the cost floor.
    const fastPathOk = aiPhrasingFastPathAllowed(req, deps, identity.uid);
    // Previously-logged free text is fed as CONTEXT — as DATA, never code — and
    // capped to the AI-input limit so token cost is bounded.
    const context = capAiInput(activities.map((a) => a.activity).join(" | "));

    // Phrase SEQUENTIALLY so the per-call quota reservation can stop AI work the
    // moment the daily limit is hit. Only the top MAX_AI_PHRASED_INSIGHTS are
    // ever candidates, and each phraser call reserves ONE quota unit — so the
    // model-call count can never exceed the reservation. Everything else
    // degrades to neutral. The quota day uses the user time zone (defaults UTC).
    const phrased: PhrasedInsight[] = [];
    let phrasedCount = 0;
    for (const insight of insights) {
      let ai: AiPort | undefined;
      if (
        fastPathOk &&
        deps.ai &&
        phrasedCount < MAX_AI_PHRASED_INSIGHTS &&
        (
          await reserveAiCall(deps.data, identity.uid, {
            ...(timeZone !== undefined && { timeZone }),
          })
        ).allowed
      ) {
        ai = deps.ai;
        phrasedCount += 1;
      }
      phrased.push({
        id: insight.id,
        title: insight.title,
        rank: insight.rank,
        projectedKgSaved: insight.projectedKgSaved,
        projectedKgSavedDisplay: insight.projectedKgSavedDisplay,
        currentBasis: insight.currentBasis,
        alternativeBasis: insight.alternativeBasis,
        phrase: await phraseWithAi(
          ai,
          insight.title,
          insight.projectedKgSavedDisplay,
          context,
        ),
      });
    }

    return jsonResponse(200, { insights: phrased, skipped });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET(req: Request): Promise<Response> {
  return handleGet(req, await resolveDeps());
}
