import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { createContainer } from "../container";
import { InMemoryDataPort } from "../adapters/local/data";
import { MockAuthPort } from "../adapters/local/auth";
import { HttpError, errors, toErrorResponse, jsonResponse } from "./errors";
import { extractBearerToken, requireIdentity, authorizeOwner } from "./authz";
import {
  MAX_REQUEST_BYTES,
  MAX_AI_INPUT_CHARS,
  approxTokenCount,
  assertRequestSizeAllowed,
  assertWithinByteCap,
  assertAiInputWithinCap,
  readJsonBody,
  validateInput,
  validateAiOutput,
  tryValidateAiOutput,
} from "./validate";
import {
  TokenBucketRateLimiter,
  rateLimitKey,
  enforceRateLimit,
} from "./rateLimit";
import {
  DEFAULT_DAILY_AI_QUOTA,
  aiQuotaCounterName,
  reserveAiCall,
  peekAiQuota,
  enforceAiQuota,
} from "./aiQuota";
import { localeDayKey, isDayKey, InvalidTimeZoneError } from "./day";

function req(headers: Record<string, string> = {}, body?: string): Request {
  return new Request("https://verde.test/api/x", {
    method: "POST",
    headers,
    ...(body !== undefined && { body }),
  });
}

describe("errors — uniform JSON contract (OWASP REST)", () => {
  it("maps each code to the right status and stable shape", () => {
    expect(new HttpError("unauthorized", "x").status).toBe(401);
    expect(new HttpError("forbidden", "x").status).toBe(403);
    expect(new HttpError("invalid_input", "x").status).toBe(400);
    expect(new HttpError("invalid_ai_output", "x").status).toBe(502);
    expect(new HttpError("payload_too_large", "x").status).toBe(413);
    expect(new HttpError("rate_limited", "x").status).toBe(429);
    expect(new HttpError("quota_exceeded", "x").status).toBe(429);
    expect(new HttpError("internal", "x").status).toBe(500);
  });

  it("serializes to { error: { code, message } } with optional details", () => {
    const body = errors.payloadTooLarge("too big", { maxBytes: 10 }).toBody();
    expect(body).toEqual({
      error: {
        code: "payload_too_large",
        message: "too big",
        details: { maxBytes: 10 },
      },
    });
  });

  it("toErrorResponse keeps a known HttpError and hides unknown internals", async () => {
    const known = await toErrorResponse(errors.forbidden()).json();
    expect(known.error.code).toBe("forbidden");

    const leaky = toErrorResponse(
      new Error("DB password is hunter2 at line 42"),
    );
    expect(leaky.status).toBe(500);
    const body = await leaky.json();
    expect(body.error.code).toBe("internal");
    expect(JSON.stringify(body)).not.toMatch(/hunter2|line 42/);
  });

  it("jsonResponse sets a JSON content-type", () => {
    const res = jsonResponse(200, { ok: true });
    expect(res.headers.get("content-type")).toBe("application/json");
  });
});

describe("authz — bearer token + per-route ownership", () => {
  it("extracts a bearer token case-insensitively, else null", () => {
    expect(extractBearerToken(req({ authorization: "Bearer abc" }))).toBe(
      "abc",
    );
    expect(extractBearerToken(req({ authorization: "bearer  xyz " }))).toBe(
      "xyz",
    );
    expect(extractBearerToken(req({}))).toBeNull();
    expect(extractBearerToken(req({ authorization: "Basic abc" }))).toBeNull();
  });

  it("requireIdentity resolves a verified identity via the AuthPort", async () => {
    const auth = new MockAuthPort();
    const anon = await auth.signInAnonymously();
    const identity = await requireIdentity(
      req({ authorization: `Bearer ${anon.uid}` }),
      auth,
    );
    expect(identity.uid).toBe(anon.uid);
    expect(identity.isAnonymous).toBe(true);
  });

  it("requireIdentity throws 401 with no token", async () => {
    const auth = new MockAuthPort();
    await expect(requireIdentity(req({}), auth)).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });

  it("requireIdentity throws 401 on an unknown token (no uid forgery)", async () => {
    const auth = new MockAuthPort();
    await expect(
      requireIdentity(req({ authorization: "Bearer not-a-real-uid" }), auth),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("authorizeOwner forbids acting on another uid", () => {
    const identity = { uid: "uid-a", isAnonymous: true };
    expect(() => authorizeOwner(identity, "uid-a")).not.toThrow();
    expect(() => authorizeOwner(identity, "uid-b")).toThrow(HttpError);
    try {
      authorizeOwner(identity, "uid-b");
    } catch (e) {
      expect((e as HttpError).status).toBe(403);
    }
  });
});

describe("validate — Zod input + AI output + size/token cap", () => {
  const inputSchema = z.object({ text: z.string().min(1) });

  it("validateInput passes good input and rejects bad input as 400", () => {
    expect(validateInput({ text: "hi" }, inputSchema)).toEqual({ text: "hi" });
    expect(() => validateInput({ text: "" }, inputSchema)).toThrow(HttpError);
    try {
      validateInput({}, inputSchema);
    } catch (e) {
      expect((e as HttpError).code).toBe("invalid_input");
      // SAFE message — no raw Zod field dump leaks to the client.
      expect((e as HttpError).message).not.toMatch(/text|required|ZodError/i);
    }
  });

  it("validateAiOutput rejects an unvalidatable model response as 502", () => {
    const aiSchema = z.object({ items: z.array(z.string()) });
    expect(validateAiOutput({ items: ["a"] }, aiSchema)).toEqual({
      items: ["a"],
    });
    try {
      validateAiOutput({ items: "not-an-array" }, aiSchema);
    } catch (e) {
      expect((e as HttpError).code).toBe("invalid_ai_output");
      expect((e as HttpError).status).toBe(502);
    }
  });

  it("tryValidateAiOutput returns ok/false without throwing (soft fallback)", () => {
    const aiSchema = z.object({ n: z.number() });
    expect(tryValidateAiOutput({ n: 1 }, aiSchema)).toEqual({
      ok: true,
      data: { n: 1 },
    });
    expect(tryValidateAiOutput({ n: "x" }, aiSchema)).toEqual({ ok: false });
  });

  it("readJsonBody parses + validates a good body", async () => {
    const body = await readJsonBody(
      req(
        { "content-type": "application/json" },
        JSON.stringify({ text: "hi" }),
      ),
      inputSchema,
    );
    expect(body).toEqual({ text: "hi" });
  });

  it("readJsonBody rejects non-JSON as 400", async () => {
    await expect(
      readJsonBody(req({}, "{not json"), inputSchema),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("assertRequestSizeAllowed rejects an oversize content-length as 413", () => {
    expect(() =>
      assertRequestSizeAllowed(
        req({ "content-length": String(MAX_REQUEST_BYTES + 1) }),
      ),
    ).toThrow(HttpError);
    expect(() =>
      assertRequestSizeAllowed(req({ "content-length": "10" })),
    ).not.toThrow();
  });

  it("assertWithinByteCap rejects an oversize raw body (byte length, not char length)", () => {
    const huge = "x".repeat(MAX_REQUEST_BYTES + 1);
    try {
      assertWithinByteCap(huge);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as HttpError).code).toBe("payload_too_large");
    }
  });

  it("readJsonBody enforces the byte cap even with a lying content-length", async () => {
    const huge = JSON.stringify({ text: "y".repeat(MAX_REQUEST_BYTES) });
    await expect(
      readJsonBody(req({ "content-length": "5" }, huge), inputSchema),
    ).rejects.toMatchObject({ code: "payload_too_large" });
  });

  it("assertAiInputWithinCap rejects an over-long NL string BEFORE any AI call", () => {
    const overlong = "a".repeat(MAX_AI_INPUT_CHARS + 1);
    try {
      assertAiInputWithinCap(overlong);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as HttpError).code).toBe("payload_too_large");
      expect((e as HttpError).details?.approxTokens).toBe(
        approxTokenCount(overlong),
      );
    }
    expect(() => assertAiInputWithinCap("drove 20 km")).not.toThrow();
  });
});

describe("rateLimit — in-memory token bucket (fast path)", () => {
  it("allows up to capacity then denies with a retry hint", () => {
    const t = 0;
    const limiter = new TokenBucketRateLimiter({
      capacity: 3,
      refillPerSecond: 1,
      now: () => t,
    });
    expect(limiter.consume("k").allowed).toBe(true);
    expect(limiter.consume("k").allowed).toBe(true);
    expect(limiter.consume("k").allowed).toBe(true);
    const denied = limiter.consume("k");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("refills over time", () => {
    let t = 0;
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillPerSecond: 1,
      now: () => t,
    });
    limiter.consume("k");
    limiter.consume("k");
    expect(limiter.consume("k").allowed).toBe(false);
    t += 1000;
    expect(limiter.consume("k").allowed).toBe(true);
  });

  it("isolates buckets per key", () => {
    const t = 0;
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillPerSecond: 1,
      now: () => t,
    });
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
  });

  it("rateLimitKey prefers uid, falls back to forwarded IP", () => {
    expect(rateLimitKey(req({}), "uid-1")).toBe("uid:uid-1");
    expect(
      rateLimitKey(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), null),
    ).toBe("ip:1.2.3.4");
    expect(rateLimitKey(req({}), null)).toBe("ip:unknown");
  });

  it("enforceRateLimit throws 429 when over the limit", () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillPerSecond: 1,
    });
    enforceRateLimit(limiter, "k");
    try {
      enforceRateLimit(limiter, "k");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as HttpError).code).toBe("rate_limited");
      expect((e as HttpError).status).toBe(429);
    }
  });
});

describe("day — shared user-locale day-boundary helper", () => {
  it("produces a YYYY-MM-DD key matching the streak date shape", () => {
    const key = localeDayKey(new Date("2026-06-20T12:00:00Z"), "UTC");
    expect(key).toBe("2026-06-20");
    expect(isDayKey(key)).toBe(true);
  });

  it("is timezone-correct across a midnight boundary", () => {
    // 2026-06-20T02:30Z is still June 19 in Los Angeles (UTC-7 in summer).
    const instant = new Date("2026-06-20T02:30:00Z");
    expect(localeDayKey(instant, "UTC")).toBe("2026-06-20");
    expect(localeDayKey(instant, "America/Los_Angeles")).toBe("2026-06-19");
  });

  it("throws on an unknown time zone (never silently falls back to UTC)", () => {
    expect(() => localeDayKey(new Date(), "Mars/Phobos")).toThrow(
      InvalidTimeZoneError,
    );
  });
});

describe("aiQuota — persisted daily quota via the REAL in-mem DataPort", () => {
  let data: InMemoryDataPort;
  const FIXED = new Date("2026-06-20T12:00:00Z");
  const opts = { dailyLimit: 3, timeZone: "UTC", now: () => FIXED };

  beforeEach(() => {
    data = new InMemoryDataPort();
  });

  it("reserves calls against the real counter doc until exhausted", async () => {
    const r1 = await reserveAiCall(data, "anon-1", opts);
    await reserveAiCall(data, "anon-1", opts);
    const r3 = await reserveAiCall(data, "anon-1", opts);
    const r4 = await reserveAiCall(data, "anon-1", opts);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
    expect(r4.allowed).toBe(false);
    expect(r4.used).toBe(3);

    // The usage is genuinely PERSISTED in the DataPort counter doc.
    const counter = aiQuotaCounterName("2026-06-20");
    expect(await data.getCounter("anon-1", counter)).toBe(4);
  });

  it("survives a SIMULATED instance restart — quota is not bypassed by a new limiter", async () => {
    // The in-mem limiter is per-instance; the persisted quota is the floor.
    await reserveAiCall(data, "anon-1", opts);
    await reserveAiCall(data, "anon-1", opts);
    await reserveAiCall(data, "anon-1", opts);
    // "New instance" = fresh limiter, SAME shared DataPort store.
    const onNewInstance = await reserveAiCall(data, "anon-1", opts);
    expect(onNewInstance.allowed).toBe(false);
  });

  it("is isolated per uid and resets on the locale-day boundary", async () => {
    await reserveAiCall(data, "anon-1", opts);
    await reserveAiCall(data, "anon-1", opts);
    await reserveAiCall(data, "anon-1", opts);
    expect((await reserveAiCall(data, "anon-1", opts)).allowed).toBe(false);

    // Different uid: fresh quota.
    expect((await reserveAiCall(data, "anon-2", opts)).allowed).toBe(true);

    // Next locale-day: fresh counter doc, quota resets.
    const nextDay = {
      ...opts,
      now: () => new Date("2026-06-21T12:00:00Z"),
    };
    expect((await reserveAiCall(data, "anon-1", nextDay)).allowed).toBe(true);
  });

  it("peekAiQuota reports usage WITHOUT consuming", async () => {
    await reserveAiCall(data, "anon-1", opts);
    const peek = await peekAiQuota(data, "anon-1", opts);
    expect(peek.used).toBe(1);
    expect(peek.remaining).toBe(2);
    // peek did not increment.
    expect(await peekAiQuota(data, "anon-1", opts)).toMatchObject({ used: 1 });
  });

  it("enforceAiQuota throws 429 quota_exceeded once exhausted", async () => {
    await enforceAiQuota(data, "anon-1", opts);
    await enforceAiQuota(data, "anon-1", opts);
    await enforceAiQuota(data, "anon-1", opts);
    await expect(enforceAiQuota(data, "anon-1", opts)).rejects.toMatchObject({
      code: "quota_exceeded",
      status: 429,
    });
  });

  it("DEFAULT_DAILY_AI_QUOTA is a sane positive bound", () => {
    expect(DEFAULT_DAILY_AI_QUOTA).toBeGreaterThan(0);
  });
});

describe("aiQuota — wired through the container's LOCAL adapter set (critic follow-up)", () => {
  it("hits the REAL in-mem counter resolved by createContainer (not a stub)", async () => {
    const c = await createContainer({ APP_ENV: "local" });
    expect(c.data).toBeInstanceOf(InMemoryDataPort);
    const identity = await c.auth.signInAnonymously();
    const opts = {
      dailyLimit: 2,
      timeZone: "UTC",
      now: () => new Date("2026-06-20T00:00:00Z"),
    };

    expect((await reserveAiCall(c.data, identity.uid, opts)).allowed).toBe(
      true,
    );
    expect((await reserveAiCall(c.data, identity.uid, opts)).allowed).toBe(
      true,
    );
    expect((await reserveAiCall(c.data, identity.uid, opts)).allowed).toBe(
      false,
    );

    // Proof it is the container's persisted counter, not an in-test stub.
    const stored = await c.data.getCounter(
      identity.uid,
      aiQuotaCounterName("2026-06-20"),
    );
    expect(stored).toBe(3);
  });
});
