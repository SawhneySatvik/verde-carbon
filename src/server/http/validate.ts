import type { ZodType } from "zod";
import { errors } from "./errors";

/**
 * Zod validation guards for BOTH request input AND AI output (ADR-005). Input
 * validation rejects a malformed body as 400 `invalid_input`; AI-output
 * validation rejects an unvalidatable model response as 502 `invalid_ai_output`
 * so the handler can fall back to the structured path instead of trusting raw
 * model JSON — the calculator stays the sole producer of numbers.
 *
 * Also exports the hard request-size / input-token cap enforced BEFORE any AI
 * call: an oversize body or an over-long NL string is rejected up front so
 * an attacker cannot drive AI cost with a huge payload.
 */

export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_AI_INPUT_CHARS = 2_000;

/**
 * Hard cap on a DECODED image. A base64 image inflates the JSON body ~33%,
 * so the image route raises its body cap to {@link MAX_IMAGE_REQUEST_BYTES} and
 * then enforces this exact cap on the decoded bytes BEFORE any AI call — an
 * oversize image is a 413, never an AI cost.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_REQUEST_BYTES =
  Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4096;

/** Coarse token estimate: ~4 chars/token is the standard rule of thumb. */
export const APPROX_CHARS_PER_TOKEN = 4;
export const MAX_AI_INPUT_TOKENS = Math.ceil(
  MAX_AI_INPUT_CHARS / APPROX_CHARS_PER_TOKEN,
);

export function approxTokenCount(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

/**
 * Reject an oversize request body BEFORE reading/parsing it. Prefers the
 * declared `content-length`; callers that already have the raw text use
 * {@link assertWithinByteCap}. A request over the cap is a 413.
 */
export function assertRequestSizeAllowed(
  req: Request,
  maxBytes: number = MAX_REQUEST_BYTES,
): void {
  const header = req.headers.get("content-length");
  if (header !== null) {
    const declared = Number(header);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw errors.payloadTooLarge("The request body is too large.", {
        maxBytes,
      });
    }
  }
}

export function assertWithinByteCap(
  raw: string,
  maxBytes: number = MAX_REQUEST_BYTES,
): void {
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > maxBytes) {
    throw errors.payloadTooLarge("The request body is too large.", {
      maxBytes,
      bytes,
    });
  }
}

/**
 * Hard cap on AI input BEFORE the model is called. Enforces both a
 * character cap and an approximate input-token cap so cost is bounded
 * regardless of the persisted daily quota.
 */
export function assertAiInputWithinCap(
  input: string,
  maxChars: number = MAX_AI_INPUT_CHARS,
): void {
  if (input.length > maxChars) {
    throw errors.payloadTooLarge(
      "The activity description is too long; please shorten it.",
      { maxChars, chars: input.length, approxTokens: approxTokenCount(input) },
    );
  }
}

/**
 * Decode a base64 image and enforce the hard DECODED-byte cap BEFORE any AI call.
 * Returns the decoded bytes so the caller does not decode twice. An
 * over-cap image is a 413 `payload_too_large` — an attacker cannot drive
 * multimodal AI cost with a huge image. A non-decodable string is a 413 too
 * (treated as oversize/garbage rather than a generic 400) so the route's single
 * fallback path covers it.
 */
export function assertImageBytesWithinCap(
  imageBase64: string,
  maxBytes: number = MAX_IMAGE_BYTES,
): Uint8Array {
  // Coarse pre-check on the encoded length: 4 base64 chars encode 3 bytes, so a
  // string longer than this CANNOT decode under the cap — reject before decoding.
  if (imageBase64.length > Math.ceil((maxBytes * 4) / 3) + 4) {
    throw errors.payloadTooLarge("The image is too large.", { maxBytes });
  }
  const bytes = new Uint8Array(Buffer.from(imageBase64, "base64"));
  if (bytes.length === 0) {
    throw errors.payloadTooLarge("The image could not be decoded.", {
      maxBytes,
    });
  }
  if (bytes.length > maxBytes) {
    throw errors.payloadTooLarge("The image is too large.", {
      maxBytes,
      bytes: bytes.length,
    });
  }
  return bytes;
}

/**
 * Same hard AI-input cap as {@link assertAiInputWithinCap} but for callers that
 * degrade gracefully: instead of a 413 it TRUNCATES the input to the cap. Used
 * by endpoints where the AI call is OPTIONAL (e.g. insights phrasing) so an
 * over-cap context bounds token cost without failing the whole response.
 */
export function capAiInput(
  input: string,
  maxChars: number = MAX_AI_INPUT_CHARS,
): string {
  return input.length > maxChars ? input.slice(0, maxChars) : input;
}

/** Parse the JSON body of a request, size-capped, into a validated shape. */
export async function readJsonBody<T>(
  req: Request,
  schema: ZodType<T>,
  maxBytes: number = MAX_REQUEST_BYTES,
): Promise<T> {
  assertRequestSizeAllowed(req, maxBytes);
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    throw errors.invalidInput("The request body could not be read.");
  }
  assertWithinByteCap(raw, maxBytes);

  let parsed: unknown;
  try {
    parsed = raw.length === 0 ? undefined : JSON.parse(raw);
  } catch {
    throw errors.invalidInput("The request body is not valid JSON.");
  }
  return validateInput(parsed, schema);
}

/** Validate already-parsed input. Throws 400 with a SAFE message (no Zod dump). */
export function validateInput<T>(value: unknown, schema: ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw errors.invalidInput("The request input is invalid.");
  }
  return result.data;
}

/**
 * Validate AI output. A failure is a 502 `invalid_ai_output` so the handler
 * routes to the structured fallback instead of returning unverified model JSON.
 */
export function validateAiOutput<T>(value: unknown, schema: ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw errors.invalidAiOutput();
  }
  return result.data;
}

/** Non-throwing AI-output validation for handlers that degrade gracefully. */
export function tryValidateAiOutput<T>(
  value: unknown,
  schema: ZodType<T>,
): { ok: true; data: T } | { ok: false } {
  const result = schema.safeParse(value);
  return result.success ? { ok: true, data: result.data } : { ok: false };
}
