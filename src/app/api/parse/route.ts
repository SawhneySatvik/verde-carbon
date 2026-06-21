import { z } from "zod";
import { aiParseResultSchema, type AiParseResult } from "@core/schemas";
import type { AiPort, AuthPort, DataPort } from "@core/ports";
import { createContainer } from "@/server/container";
import {
  assertAiInputWithinCap,
  enforceRateLimit,
  jsonResponse,
  readJsonBody,
  requireIdentity,
  reserveAiCall,
  toErrorResponse,
  TokenBucketRateLimiter,
  tryValidateAiOutput,
  rateLimitKey,
} from "@/server/http";

/**
 * POST /api/parse. Composes the shared guards in order:
 *   requireIdentity -> enforceRateLimit -> assertAiInputWithinCap
 *   -> reserveAiCall (persisted daily quota) -> AiPort.parse
 *   -> tryValidateAiOutput (Zod: unit enum, bounded value, known key).
 *
 * This handler NEVER computes a CO2e number (ADR-001) — it only returns the
 * Zod-validated parse so the CLIENT-IMPORTABLE preview compute can show the
 * breakdown before anything is persisted ("show before save"). On any
 * failure/timeout/malformed/quota-exceeded it returns a NON-BLOCKING
 * `{ fallback: true, reason }` 200 signal so the UI drops to the structured
 * fallback form — never raw model garbage, never a hard 500 for these cases.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// `input` is bounded only by the request byte-cap here; the EXACT AI-input char
// cap is enforced by assertAiInputWithinCap so an over-cap string yields the
// canonical 413 payload_too_large (not a generic 400) before any AI call.
export const parseInputSchema = z
  .object({
    input: z.string().min(1),
    locale: z.string().min(1).max(40).optional(),
    timeZone: z.string().min(1).max(64).optional(),
  })
  .strict();
export type ParseInput = z.infer<typeof parseInputSchema>;

export type ParseFallbackReason =
  | "quota_exceeded"
  | "ai_unavailable"
  | "invalid_ai_output";

export interface ParseOkResponse {
  fallback: false;
  parse: AiParseResult;
}

export interface ParseFallbackResponse {
  fallback: true;
  reason: ParseFallbackReason;
  message: string;
}

export type ParseResponse = ParseOkResponse | ParseFallbackResponse;

export interface ParseDeps {
  auth: AuthPort;
  data: DataPort;
  ai: AiPort;
  limiter: TokenBucketRateLimiter;
}

// One process-wide fast-path limiter (per-instance burst control); the persisted
// daily quota in the DataPort is the multi-instance correctness floor.
const sharedLimiter = new TokenBucketRateLimiter({
  capacity: 20,
  refillPerSecond: 1,
});

async function resolveDeps(): Promise<ParseDeps> {
  const { auth, data, ai } = await createContainer();
  return { auth, data, ai, limiter: sharedLimiter };
}

function fallback(reason: ParseFallbackReason, message: string): Response {
  const body: ParseFallbackResponse = { fallback: true, reason, message };
  return jsonResponse(200, body);
}

/**
 * Injectable handler core (testable without the Next.js runtime). The thin
 * `POST` export below wires it to the real container.
 */
export async function handleParse(
  req: Request,
  deps: ParseDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    enforceRateLimit(deps.limiter, rateLimitKey(req, identity.uid));

    const body = await readJsonBody(req, parseInputSchema);
    assertAiInputWithinCap(body.input);

    const quota = await reserveAiCall(deps.data, identity.uid, {
      ...(body.timeZone !== undefined && { timeZone: body.timeZone }),
    });
    if (!quota.allowed) {
      return fallback(
        "quota_exceeded",
        "The daily AI usage limit has been reached; use the structured fallback.",
      );
    }

    let raw: unknown;
    try {
      raw = await deps.ai.parseActivity({
        input: body.input,
        ...(body.locale !== undefined && { locale: body.locale }),
      });
    } catch {
      return fallback(
        "ai_unavailable",
        "The parser is unavailable right now; use the structured fallback.",
      );
    }

    const validated = tryValidateAiOutput(raw, aiParseResultSchema);
    if (!validated.ok) {
      return fallback(
        "invalid_ai_output",
        "The AI response could not be validated; use the structured fallback.",
      );
    }

    const okBody: ParseOkResponse = { fallback: false, parse: validated.data };
    return jsonResponse(200, okBody);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const deps = await resolveDeps();
  return handleParse(req, deps);
}
