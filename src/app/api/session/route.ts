import type { AuthPort } from "@core/ports";
import { createContainer } from "@/server/container";
import type { AppEnv } from "@/server/env";
import {
  extractBearerToken,
  jsonResponse,
  requireIdentity,
  toErrorResponse,
} from "@/server/http";

/**
 * POST/GET /api/session — anonymous session bootstrap.
 *
 * Anonymous is first-class: the whole core loop is usable with no account, but
 * the Route Handlers still authorize per-uid via the AuthPort (OWASP REST —
 * never trust a client-supplied uid). The client obtains a session token here
 * and sends it as `Authorization: Bearer <token>` on every subsequent /api call.
 *
 *  - POST: provision a fresh anonymous identity via `AuthPort.signInAnonymously`
 *    and return its token. In the local adapter the token IS the anon uid (the
 *    adapter resolves identity by token).
 *  - GET: echo the current identity for an existing token, so the client reuses a
 *    stored session instead of minting a new anon uid on every reload (which would
 *    orphan the previous session's data).
 *
 * Under APP_ENV=gcp the bearer is a Firebase ID token obtained client-side via
 * the Firebase Web SDK (`signInAnonymously` / `linkWithCredential`); the GET path
 * verifies it through `AuthPort.getCurrentIdentity`. The default APP_ENV=local
 * runs the full loop with no external auth.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface SessionResponse {
  token: string;
  uid: string;
  isAnonymous: boolean;
}

export interface SessionDeps {
  auth: AuthPort;
  appEnv: AppEnv;
}

async function resolveDeps(): Promise<SessionDeps> {
  const { auth, appEnv } = await createContainer();
  return { auth, appEnv };
}

export async function handlePost(
  req: Request,
  deps: SessionDeps,
): Promise<Response> {
  try {
    if (deps.appEnv === "gcp") {
      // GCP mode: the browser signs in with the Firebase Web SDK and sends its
      // ID token, so the server verifies-and-echoes it and NEVER mints. A
      // server-side mint here would call FirebaseAuth.createUser, letting an
      // unauthenticated caller create accounts at will (abuse / cost). No token
      // resolves to a 401, which the client answers by signing in client-side.
      const identity = await requireIdentity(req, deps.auth);
      const token = extractBearerToken(req) ?? identity.uid;
      return jsonResponse(200, {
        token,
        uid: identity.uid,
        isAnonymous: identity.isAnonymous,
      } satisfies SessionResponse);
    }

    // Local mode: the browser cannot mint a verified identity, so provision an
    // anonymous session server-side. The token IS the anon uid (the adapter
    // resolves identity by token); the client stores it and sends it as bearer.
    const identity = await deps.auth.signInAnonymously();
    return jsonResponse(201, {
      token: identity.uid,
      uid: identity.uid,
      isAnonymous: identity.isAnonymous,
    } satisfies SessionResponse);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function handleGet(
  req: Request,
  deps: SessionDeps,
): Promise<Response> {
  try {
    // If the client already holds a token, confirm it resolves to a live
    // identity (so a stored session is reused rather than re-minted). With no
    // token this is a 401 the client treats as "mint a new anon session".
    const identity = await requireIdentity(req, deps.auth);
    const token = extractBearerToken(req) ?? identity.uid;
    const body: SessionResponse = {
      token,
      uid: identity.uid,
      isAnonymous: identity.isAnonymous,
    };
    return jsonResponse(200, body);
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
