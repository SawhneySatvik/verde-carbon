/**
 * Uniform JSON error contract for every Route Handler (OWASP REST Security).
 * Every failure crosses the wire as `{ error: { code, message } }` with a stable,
 * machine-readable `code` and a SAFE, generic `message` — no stack traces, no
 * internal identifiers, no raw model/Zod output that could leak structure to an
 * attacker. Handlers throw an {@link HttpError} (or use the helpers) and let a
 * shared boundary serialize it, so the shape is consistent across all routes.
 */

export type HttpErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_input"
  | "invalid_ai_output"
  | "payload_too_large"
  | "rate_limited"
  | "quota_exceeded"
  | "not_found"
  | "internal";

const STATUS_BY_CODE: Record<HttpErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  invalid_input: 400,
  invalid_ai_output: 502,
  payload_too_large: 413,
  rate_limited: 429,
  quota_exceeded: 429,
  not_found: 404,
  internal: 500,
};

export interface ErrorBody {
  error: {
    code: HttpErrorCode;
    message: string;
    /** Optional non-sensitive, machine-readable hints (e.g. retryAfterSeconds). */
    details?: Record<string, string | number>;
  };
}

export class HttpError extends Error {
  readonly code: HttpErrorCode;
  readonly status: number;
  readonly details?: Record<string, string | number>;

  constructor(
    code: HttpErrorCode,
    message: string,
    details?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (details !== undefined) {
      this.details = details;
    }
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
      },
    };
  }

  toResponse(): Response {
    return jsonResponse(this.status, this.toBody());
  }
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Serialize any thrown value into the uniform error response. A known
 * {@link HttpError} keeps its code/status; anything else collapses to a generic
 * 500 so an unexpected error never leaks an internal message to the client
 * (OWASP REST: do not expose stack traces or internals).
 */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return err.toResponse();
  }
  return new HttpError(
    "internal",
    "An unexpected error occurred.",
  ).toResponse();
}

export const errors = {
  unauthorized: (message = "Authentication is required."): HttpError =>
    new HttpError("unauthorized", message),
  forbidden: (
    message = "You do not have access to this resource.",
  ): HttpError => new HttpError("forbidden", message),
  invalidInput: (message = "The request input is invalid."): HttpError =>
    new HttpError("invalid_input", message),
  invalidAiOutput: (
    message = "The AI response could not be validated; use the structured fallback.",
  ): HttpError => new HttpError("invalid_ai_output", message),
  payloadTooLarge: (
    message = "The request is too large.",
    details?: Record<string, string | number>,
  ): HttpError => new HttpError("payload_too_large", message, details),
  rateLimited: (retryAfterSeconds?: number): HttpError =>
    new HttpError(
      "rate_limited",
      "Too many requests; slow down.",
      retryAfterSeconds !== undefined ? { retryAfterSeconds } : undefined,
    ),
  quotaExceeded: (
    message = "The daily AI usage limit has been reached; use the structured fallback.",
  ): HttpError => new HttpError("quota_exceeded", message),
  notFound: (message = "Not found."): HttpError =>
    new HttpError("not_found", message),
  internal: (message = "An unexpected error occurred."): HttpError =>
    new HttpError("internal", message),
};
