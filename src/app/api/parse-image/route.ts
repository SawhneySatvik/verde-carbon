import { z } from "zod";
import {
  aiParseImageRequestSchema,
  aiParseResultSchema,
  type AiParseResult,
} from "@core/schemas";
import type { AiPort, AuthPort, DataPort } from "@core/ports";
import { createContainer } from "@/server/container";
import {
  AI_RATE_LIMIT,
  assertImageBytesWithinCap,
  enforceRateLimit,
  jsonResponse,
  MAX_IMAGE_REQUEST_BYTES,
  rateLimitKey,
  readJsonBody,
  requireIdentity,
  reserveAiCall,
  toErrorResponse,
  TokenBucketRateLimiter,
  tryValidateAiOutput,
} from "@/server/http";

/**
 * POST /api/parse-image (image meal/receipt logging). Composes the
 * SAME shared guards as /api/parse, in order:
 *   requireIdentity -> enforceRateLimit -> readJsonBody (raised image body cap)
 *   -> assertImageBytesWithinCap (hard DECODED-byte cap; oversize -> 413)
 *   -> reserveAiCall (the SHARED persisted daily quota) -> AiPort.parseImage
 *   -> tryValidateAiOutput (Zod: unit enum, bounded value).
 *
 * This handler NEVER computes a CO2e number (ADR-001) — image AI proposes
 * candidate factor keys + quantities only; the calculator is the sole producer
 * of emission numbers. On any failure/timeout/malformed/quota-exceeded it returns
 * a NON-BLOCKING `{ fallback: true, reason }` 200 signal so the UI drops to the
 * structured fallback — never raw model garbage, never a number, never a hard 500
 * for these cases. The ONE exception that is a real status code is an oversize
 * image, which is a 413 BEFORE any AI call (cost protection).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The body is the AiParseImageRequest plus an optional user `timeZone` (threaded
// into the persisted quota day-key, exactly like /api/parse). The decoded-byte
// cap is NOT enforced by Zod here — `assertImageBytesWithinCap` does it on the
// decoded bytes so an oversize image yields the canonical 413.
export const parseImageInputSchema = aiParseImageRequestSchema
  .extend({
    timeZone: z.string().min(1).max(64).optional(),
  })
  .strict();
export type ParseImageInput = z.infer<typeof parseImageInputSchema>;

export type ParseImageFallbackReason =
  | "quota_exceeded"
  | "ai_unavailable"
  | "invalid_ai_output"
  | "no_items";

export interface ParseImageOkResponse {
  fallback: false;
  parse: AiParseResult;
}

export interface ParseImageFallbackResponse {
  fallback: true;
  reason: ParseImageFallbackReason;
  message: string;
}

export type ParseImageResponse =
  | ParseImageOkResponse
  | ParseImageFallbackResponse;

export interface ParseImageDeps {
  auth: AuthPort;
  data: DataPort;
  ai: AiPort;
  limiter: TokenBucketRateLimiter;
}

// One process-wide fast-path limiter (per-instance burst control); the persisted
// daily quota in the DataPort is the multi-instance correctness floor. This
// is the SAME limiter contract as /api/parse, kept per-route so an image burst
// and a text burst are independently throttled.
const sharedLimiter = new TokenBucketRateLimiter(AI_RATE_LIMIT);

async function resolveDeps(): Promise<ParseImageDeps> {
  const { auth, data, ai } = await createContainer();
  return { auth, data, ai, limiter: sharedLimiter };
}

function fallback(reason: ParseImageFallbackReason, message: string): Response {
  const body: ParseImageFallbackResponse = { fallback: true, reason, message };
  return jsonResponse(200, body);
}

/**
 * Injectable handler core (testable without the Next.js runtime). The thin
 * `POST` export below wires it to the real container.
 */
export async function handleParseImage(
  req: Request,
  deps: ParseImageDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    enforceRateLimit(deps.limiter, rateLimitKey(req, identity.uid));

    const body = await readJsonBody(
      req,
      parseImageInputSchema,
      MAX_IMAGE_REQUEST_BYTES,
    );
    // Hard cap on the DECODED image bytes (oversize -> 413) BEFORE any AI call.
    assertImageBytesWithinCap(body.imageBase64);

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
      raw = await deps.ai.parseImage({
        imageBase64: body.imageBase64,
        imageMediaType: body.imageMediaType,
        ...(body.context !== undefined && { context: body.context }),
        ...(body.locale !== undefined && { locale: body.locale }),
      });
    } catch {
      return fallback(
        "ai_unavailable",
        "The image parser is unavailable right now; use the structured fallback.",
      );
    }

    const validated = tryValidateAiOutput(raw, aiParseResultSchema);
    if (!validated.ok) {
      return fallback(
        "invalid_ai_output",
        "The AI response could not be validated; use the structured fallback.",
      );
    }

    // An unreadable/unrecorded image yields a clarification-only result (zero
    // items). For the image flow that is a non-blocking fallback so the UI drops
    // to the structured form rather than rendering an empty parse — the
    // clarification text is carried along for the prompt.
    if (validated.data.items.length === 0) {
      return fallback(
        "no_items",
        validated.data.clarification ??
          "No items could be read from this image; use the structured fallback.",
      );
    }

    const okBody: ParseImageOkResponse = {
      fallback: false,
      parse: validated.data,
    };
    return jsonResponse(200, okBody);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const deps = await resolveDeps();
  return handleParseImage(req, deps);
}
