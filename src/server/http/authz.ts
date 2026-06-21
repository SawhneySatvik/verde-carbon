import type { AuthIdentity, AuthPort } from "@core/ports";
import { errors } from "./errors";

/**
 * Per-route authorization (OWASP REST). Resolves the caller's identity from the
 * `Authorization: Bearer <token>` header via the AuthPort — server-side, never
 * trusting a client-supplied uid in the body. Handlers compose this FIRST so
 * every downstream step (rate-limit, quota, data access) keys off a verified uid.
 */

const BEARER_RE = /^Bearer\s+(.+)$/i;

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = BEARER_RE.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve and return the verified identity, or throw a 401. The token is
 * verified through the AuthPort (mock locally, Firebase Auth on GCP) — there is
 * no path to a uid that did not come from the auth provider.
 */
export async function requireIdentity(
  req: Request,
  auth: AuthPort,
): Promise<AuthIdentity> {
  const token = extractBearerToken(req);
  if (!token) {
    throw errors.unauthorized("Missing bearer token.");
  }
  const identity = await auth.getCurrentIdentity(token);
  if (!identity) {
    throw errors.unauthorized("Invalid or expired token.");
  }
  return identity;
}

/**
 * Authorize that the verified caller owns `resourceUid`. Anonymous users are
 * first-class here (the whole core loop is anonymous), but a caller may never
 * act on another uid's resources — that is a 403, not a 404, because the caller
 * is authenticated but not entitled.
 */
export function authorizeOwner(
  identity: AuthIdentity,
  resourceUid: string,
): void {
  if (identity.uid !== resourceUid) {
    throw errors.forbidden();
  }
}
