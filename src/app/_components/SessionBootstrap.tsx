"use client";

import { useEffect } from "react";

/**
 * Anonymous-session bootstrap + fetch interceptor. The app silently provisions an
 * anonymous session; anonymous is first-class.
 *
 * Mounted ONCE in the app shell, so it runs for every real screen but NOT in the
 * per-component unit tests (which render pages without the shell and stub
 * `fetch` directly — their request shapes and call counts stay untouched).
 *
 * Why an interceptor rather than wrapping each page's fetch: the Route Handlers
 * authorize per-uid via the AuthPort (OWASP REST — they never trust a client uid)
 * so every /api call needs a verified bearer token. The browser can't mint one
 * itself, so on first load we POST /api/session to provision an anonymous
 * session, cache its token (sessionStorage, reused across reloads so the SAME
 * anon uid — and its logged data — persists), and patch `window.fetch` to attach
 * `Authorization: Bearer <token>` to same-origin /api/* requests. Pages keep
 * their exact `fetch("/api/...")` calls; only the header is added, and only in
 * the running app.
 */

const TOKEN_STORAGE_KEY = "verde.session.token";
const PATCHED_FLAG = "__verdeFetchPatched";

interface SessionResponse {
  token: string;
  uid: string;
  isAnonymous: boolean;
}

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // best-effort
  }
}

let sessionPromise: Promise<string | null> | null = null;

async function mintSession(realFetch: typeof fetch): Promise<string | null> {
  const res = await realFetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as Partial<SessionResponse>;
  if (typeof data.token === "string" && data.token.length > 0) {
    storeToken(data.token);
    return data.token;
  }
  return null;
}

function ensureSession(realFetch: typeof fetch): Promise<string | null> {
  if (!sessionPromise) {
    const stored = readStoredToken();
    sessionPromise = stored
      ? Promise.resolve(stored)
      : mintSession(realFetch).catch(() => null);
  }
  return sessionPromise;
}

function isApiRequest(input: RequestInfo | URL): boolean {
  let path: string;
  if (typeof input === "string") {
    path = input;
  } else if (input instanceof URL) {
    path = input.pathname;
  } else {
    path = input.url;
  }
  // Same-origin /api/* only. The session endpoint authenticates itself, so it is
  // intentionally excluded from the bearer-injection path.
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) {
      return false;
    }
    return url.pathname.startsWith("/api/") && url.pathname !== "/api/session";
  } catch {
    return path.startsWith("/api/") && !path.startsWith("/api/session");
  }
}

function patchFetch(): void {
  const w = window as typeof window & { [PATCHED_FLAG]?: boolean };
  if (w[PATCHED_FLAG]) {
    return;
  }
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiRequest(input)) {
      return realFetch(input, init);
    }
    const token = await ensureSession(realFetch);
    if (!token) {
      return realFetch(input, init);
    }
    const headers = new Headers(init?.headers);
    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return realFetch(input, { ...init, headers });
  };

  w[PATCHED_FLAG] = true;
}

/** Renders nothing; installs the session + fetch interceptor on mount. */
export function SessionBootstrap() {
  useEffect(() => {
    patchFetch();
    // Kick off the anon session immediately so the first data fetch on any
    // screen already has a token waiting (avoids a 401-then-retry flash).
    void ensureSession(window.fetch.bind(window));
  }, []);
  return null;
}
