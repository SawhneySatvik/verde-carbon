import { describe, it, expect, beforeEach } from "vitest";
import type {
  AiCoachRequest,
  AiParseImageRequest,
  AiParseRequest,
  AiPhraseRequest,
  AiPort,
} from "@core/ports";
import { aiParseResultSchema, type AiParseResult } from "@core/schemas";
import { InMemoryDataPort } from "@/server/adapters/local/data";
import { MockAuthPort } from "@/server/adapters/local/auth";
import { TokenBucketRateLimiter } from "@/server/http";
import { aiQuotaCounterName } from "@/server/http";
import { localeDayKey } from "@/server/http";
import { DEFAULT_DAILY_AI_QUOTA } from "@/server/http";
import { handleParse, type ParseDeps } from "./route";

const VALID_PARSE: AiParseResult = aiParseResultSchema.parse({
  items: [
    {
      activity: "drove",
      value: 20,
      unit: "km",
      candidateFactorKey: "transport.car.gasoline",
      confidence: 0.92,
    },
  ],
});

class StubAi implements AiPort {
  public calls = 0;
  constructor(
    private readonly impl: (req: AiParseRequest) => Promise<unknown>,
  ) {}
  async parseActivity(req: AiParseRequest): Promise<AiParseResult> {
    this.calls += 1;
    return (await this.impl(req)) as AiParseResult;
  }
  async parseImage(_req: AiParseImageRequest): Promise<AiParseResult> {
    throw new Error("not used by the text parse route");
  }
  async phraseInsight(_req: AiPhraseRequest): Promise<string> {
    return "";
  }
  async coach(_req: AiCoachRequest): Promise<string> {
    return "";
  }
}

function postReq(uid: string, body: unknown): Request {
  return new Request("https://verde.test/api/parse", {
    method: "POST",
    headers: {
      authorization: `Bearer ${uid}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

interface Harness {
  auth: MockAuthPort;
  data: InMemoryDataPort;
  uid: string;
  deps: (ai: AiPort) => ParseDeps;
}

async function harness(): Promise<Harness> {
  const auth = new MockAuthPort();
  const data = new InMemoryDataPort();
  const anon = await auth.signInAnonymously();
  const limiter = new TokenBucketRateLimiter({
    capacity: 1000,
    refillPerSecond: 1000,
  });
  return {
    auth,
    data,
    uid: anon.uid,
    deps: (ai) => ({ auth, data, ai, limiter }),
  };
}

describe("POST /api/parse — guard composition + fallback-safety", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("401 when no bearer token is supplied", async () => {
    const ai = new StubAi(async () => VALID_PARSE);
    const req = new Request("https://verde.test/api/parse", {
      method: "POST",
      body: JSON.stringify({ input: "drove 20 km" }),
    });
    const res = await handleParse(req, h.deps(ai));
    expect(res.status).toBe(401);
    expect(ai.calls).toBe(0);
  });

  it("returns the Zod-validated parse and NEVER a CO2e number", async () => {
    const ai = new StubAi(async () => VALID_PARSE);
    const res = await handleParse(
      postReq(h.uid, { input: "drove 20 km" }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(false);
    expect(body.parse.items[0].candidateFactorKey).toBe(
      "transport.car.gasoline",
    );
    // The response shape structurally carries no emission field (ADR-001).
    const flat = JSON.stringify(body);
    expect(flat).not.toMatch(/co2e/i);
    expect(flat).not.toMatch(/"kg"/i);
  });

  it("rejects a malformed body as 400 (no AI call)", async () => {
    const ai = new StubAi(async () => VALID_PARSE);
    const res = await handleParse(postReq(h.uid, { input: 123 }), h.deps(ai));
    expect(res.status).toBe(400);
    expect(ai.calls).toBe(0);
  });

  it("413 (payload too large) on an over-cap NL string, before any AI call", async () => {
    const ai = new StubAi(async () => VALID_PARSE);
    const oversize = "a".repeat(2_001);
    const res = await handleParse(
      postReq(h.uid, { input: oversize }),
      h.deps(ai),
    );
    expect(res.status).toBe(413);
    expect(ai.calls).toBe(0);
  });

  it("AI THROW (timeout/unavailable) degrades to a non-blocking 200 fallback signal", async () => {
    const ai = new StubAi(async () => {
      throw new Error("upstream timeout");
    });
    const res = await handleParse(
      postReq(h.uid, { input: "drove 20 km" }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      fallback: true,
      reason: "ai_unavailable",
      message: expect.any(String),
    });
  });

  it("MALFORMED AI output (fails Zod) degrades to a non-blocking 200 fallback (never raw garbage)", async () => {
    const ai = new StubAi(async () => ({
      items: [{ activity: "x", value: -5, unit: "smoots", co2eKg: 999 }],
    }));
    const res = await handleParse(
      postReq(h.uid, { input: "drove 20 km" }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe("invalid_ai_output");
    // The unvalidated model JSON (and its planted co2e) never reaches the client.
    expect(JSON.stringify(body)).not.toMatch(/co2e|smoots/i);
  });

  it("QUOTA-EXCEEDED returns the non-blocking fallback (never a hard 500)", async () => {
    // Pre-fill the persisted counter to the limit so the next reserve denies.
    const dayKey = localeDayKey(new Date(), "UTC");
    await h.data.incrementCounter(
      h.uid,
      aiQuotaCounterName(dayKey),
      DEFAULT_DAILY_AI_QUOTA,
    );
    const ai = new StubAi(async () => VALID_PARSE);
    const res = await handleParse(
      postReq(h.uid, { input: "drove 20 km" }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe("quota_exceeded");
    expect(ai.calls).toBe(0);
  });

  it("threads the user's IANA timeZone into the persisted quota day-key", async () => {
    // 2026-01-01T07:00:00Z is still 2025-12-31 in America/New_York (UTC-5).
    const ai = new StubAi(async () => VALID_PARSE);
    const tz = "America/New_York";
    await handleParse(
      postReq(h.uid, { input: "drove 20 km", timeZone: tz }),
      h.deps(ai),
    );
    const nyDayKey = localeDayKey(new Date(), tz);
    const counter = await h.data.getCounter(
      h.uid,
      aiQuotaCounterName(nyDayKey),
    );
    expect(counter).toBe(1);
  });

  it("rate-limit exhaustion returns 429 before reserving quota or calling AI", async () => {
    const auth = new MockAuthPort();
    const data = new InMemoryDataPort();
    const anon = await auth.signInAnonymously();
    const limiter = new TokenBucketRateLimiter({
      capacity: 1,
      refillPerSecond: 0.0001,
    });
    const ai = new StubAi(async () => VALID_PARSE);
    const deps: ParseDeps = { auth, data, ai, limiter };

    const first = await handleParse(
      postReq(anon.uid, { input: "drove 20 km" }),
      deps,
    );
    expect(first.status).toBe(200);
    const second = await handleParse(
      postReq(anon.uid, { input: "drove 20 km" }),
      deps,
    );
    expect(second.status).toBe(429);
    expect(ai.calls).toBe(1);
  });
});
