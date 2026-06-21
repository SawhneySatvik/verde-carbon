import { describe, it, expect } from "vitest";
import { MockAuthPort } from "@/server/adapters/local/auth";
import { handlePost, handleGet, type SessionDeps } from "./route";

/**
 * POST/GET /api/session — anonymous session bootstrap.
 *
 * The browser can't mint a verified identity, so this route provisions an
 * anonymous session and returns a bearer token the client attaches to every
 * later /api call. It must mint a FRESH anon uid on POST and
 * verify-and-echo an existing one on GET.
 */

function deps(): SessionDeps {
  return { auth: new MockAuthPort(), appEnv: "local" };
}

function post(): Request {
  return new Request("http://localhost/api/session", { method: "POST" });
}

function postWithToken(token: string | null): Request {
  const headers: Record<string, string> = {};
  if (token !== null) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/session", {
    method: "POST",
    headers,
  });
}

function getWithToken(token: string | null): Request {
  const headers: Record<string, string> = {};
  if (token !== null) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/session", { headers });
}

describe("POST /api/session", () => {
  it("mints a fresh anonymous session and returns a token = uid", async () => {
    const d = deps();
    const res = await handlePost(post(), d);
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      token: string;
      uid: string;
      isAnonymous: boolean;
    };
    expect(body.isAnonymous).toBe(true);
    expect(body.token).toBe(body.uid);
    expect(body.uid.length).toBeGreaterThan(0);
  });

  it("mints a DISTINCT uid on each call (no session reuse on POST)", async () => {
    const d = deps();
    const a = (await (await handlePost(post(), d)).json()) as { uid: string };
    const b = (await (await handlePost(post(), d)).json()) as { uid: string };
    expect(a.uid).not.toBe(b.uid);
  });
});

describe("POST /api/session (gcp mode)", () => {
  it("verifies-and-echoes the client token instead of minting", async () => {
    const auth = new MockAuthPort();
    // Stand-in for a Firebase ID token the browser obtained client-side: a uid
    // the AuthPort already resolves.
    const existing = await auth.signInAnonymously();
    const res = await handlePost(postWithToken(existing.uid), {
      auth,
      appEnv: "gcp",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uid: string; token: string };
    expect(body.uid).toBe(existing.uid);
    expect(body.token).toBe(existing.uid);
  });

  it("rejects a tokenless mint attempt with 401 (no server-side user creation)", async () => {
    const res = await handlePost(postWithToken(null), {
      auth: new MockAuthPort(),
      appEnv: "gcp",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/session", () => {
  it("echoes the identity for a live token (session reuse)", async () => {
    const d = deps();
    const minted = (await (await handlePost(post(), d)).json()) as {
      token: string;
      uid: string;
    };
    const res = await handleGet(getWithToken(minted.token), d);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uid: string; isAnonymous: boolean };
    expect(body.uid).toBe(minted.uid);
    expect(body.isAnonymous).toBe(true);
  });

  it("returns 401 when no token is present (client then mints one)", async () => {
    const res = await handleGet(getWithToken(null), deps());
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown token", async () => {
    const res = await handleGet(getWithToken("never-minted"), deps());
    expect(res.status).toBe(401);
  });
});
