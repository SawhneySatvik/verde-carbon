// Shared Route-Handler middleware: the guards every api/*/route.ts
// composes — per-route authz, Zod validation of input AND AI output, a uniform
// JSON error contract, an in-memory token-bucket limiter (fast path), a persisted
// per-anon-uid daily AI quota (correctness floor across instances), and a hard
// request-size / input-token cap enforced before any AI call (ADR-005).
export {
  HttpError,
  errors,
  jsonResponse,
  toErrorResponse,
  type HttpErrorCode,
  type ErrorBody,
} from "./errors";
export { extractBearerToken, requireIdentity, authorizeOwner } from "./authz";
export {
  MAX_REQUEST_BYTES,
  MAX_AI_INPUT_CHARS,
  MAX_AI_CONTEXT_ACTIVITIES,
  MAX_AI_INPUT_TOKENS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_REQUEST_BYTES,
  APPROX_CHARS_PER_TOKEN,
  approxTokenCount,
  assertRequestSizeAllowed,
  assertWithinByteCap,
  assertAiInputWithinCap,
  assertImageBytesWithinCap,
  capAiInput,
  readJsonBody,
  validateInput,
  validateAiOutput,
  tryValidateAiOutput,
} from "./validate";
export {
  TokenBucketRateLimiter,
  AI_RATE_LIMIT,
  rateLimitKey,
  enforceRateLimit,
  type TokenBucketOptions,
  type RateLimitDecision,
} from "./rateLimit";
export {
  DEFAULT_DAILY_AI_QUOTA,
  aiQuotaCounterName,
  reserveAiCall,
  peekAiQuota,
  enforceAiQuota,
  type AiQuotaOptions,
  type QuotaStatus,
} from "./aiQuota";
export { localeDayKey, isDayKey, InvalidTimeZoneError } from "./day";
