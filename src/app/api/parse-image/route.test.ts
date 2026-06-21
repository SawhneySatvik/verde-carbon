import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import { RecordedAiPort } from "@/server/adapters/local/ai";
import {
  TokenBucketRateLimiter,
  aiQuotaCounterName,
  localeDayKey,
  DEFAULT_DAILY_AI_QUOTA,
} from "@/server/http";
import { handleParseImage, type ParseImageDeps } from "./route";

/** Read a curated sample and base64-encode it, mirroring the UI fetch→base64. */
function sampleBase64(name: string): string {
  const path = resolve(process.cwd(), "public/samples", name);
  return readFileSync(path).toString("base64");
}

const BEEF_SAMPLE = sampleBase64("meal-beef-burger.png");

const VALID_PARSE: AiParseResult = aiParseResultSchema.parse({
  items: [
    {
      activity: "beef burger",
      value: 1,
      unit: "meal",
      candidateFactorKey: "diet.meal.beef",
      confidence: 0.86,
    },
  ],
});

/** Stub that records calls and returns a queued result; for guard-order tests. */
class StubImageAi implements AiPort {
  public imageCalls = 0;
  constructor(
    private readonly impl: (req: AiParseImageRequest) => Promise<unknown>,
  ) {}
  async parseActivity(_req: AiParseRequest): Promise<AiParseResult> {
    throw new Error("not used by the image route");
  }
  async parseImage(req: AiParseImageRequest): Promise<AiParseResult> {
    this.imageCalls += 1;
    return (await this.impl(req)) as AiParseResult;
  }
  async phraseInsight(_req: AiPhraseRequest): Promise<string> {
    return "";
  }
  async coach(_req: AiCoachRequest): Promise<string> {
    return "";
  }
}

function postReq(uid: string, body: unknown): Request {
  return new Request("https://verde.test/api/parse-image", {
    method: "POST",
    headers: {
      authorization: `Bearer ${uid}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

interface Harness {
  data: InMemoryDataPort;
  auth: MockAuthPort;
  uid: string;
  deps: (ai: AiPort) => ParseImageDeps;
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

describe("POST /api/parse-image — guard composition + fallback-safety", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("401 when no bearer token is supplied (no AI call)", async () => {
    const ai = new StubImageAi(async () => VALID_PARSE);
    const req = new Request("https://verde.test/api/parse-image", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: BEEF_SAMPLE,
        imageMediaType: "image/png",
      }),
    });
    const res = await handleParseImage(req, h.deps(ai));
    expect(res.status).toBe(401);
    expect(ai.imageCalls).toBe(0);
  });

  it("a KNOWN sample → Zod-validated items with NO co2e field (real RecordedAiPort)", async () => {
    const ai = new RecordedAiPort();
    const res = await handleParseImage(
      postReq(h.uid, {
        imageBase64: BEEF_SAMPLE,
        imageMediaType: "image/png",
        context: "meal",
      }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(false);
    expect(body.parse.items[0].candidateFactorKey).toBe("diet.meal.beef");
    // The response structurally carries no emission number (ADR-001).
    const flat = JSON.stringify(body);
    expect(flat).not.toMatch(/co2e/i);
    expect(flat).not.toMatch(/"kg"\s*:/i);
    expect(flat).not.toMatch(/emission/i);
  });

  it("an UNKNOWN image → non-blocking 200 (clarification, never invented items)", async () => {
    const ai = new RecordedAiPort();
    // A valid but unrecorded PNG byte sequence.
    const unknown = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108020000009077",
      "hex",
    ).toString("base64");
    const res = await handleParseImage(
      postReq(h.uid, { imageBase64: unknown, imageMediaType: "image/png" }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // RecordedAiPort returns a clarification (zero items) for an unknown image.
    // The image route maps a zero-item parse to a NON-BLOCKING fallback so the UI
    // drops to the structured form — never a 500, never a number.
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe("no_items");
    expect(body.message).toContain("No recorded image parse");
  });

  it("OVERSIZE decoded image → 413 BEFORE any AI call", async () => {
    const ai = new StubImageAi(async () => VALID_PARSE);
    // ~6 MiB decoded > 5 MiB cap. Build base64 of that many bytes.
    const big = Buffer.alloc(6 * 1024 * 1024, 1).toString("base64");
    const res = await handleParseImage(
      postReq(h.uid, { imageBase64: big, imageMediaType: "image/jpeg" }),
      h.deps(ai),
    );
    expect(res.status).toBe(413);
    expect(ai.imageCalls).toBe(0);
  });

  it("AI THROW (unavailable) degrades to a non-blocking 200 fallback", async () => {
    const ai = new StubImageAi(async () => {
      throw new Error("upstream timeout");
    });
    const res = await handleParseImage(
      postReq(h.uid, { imageBase64: BEEF_SAMPLE, imageMediaType: "image/png" }),
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

  it("MALFORMED AI output (fails Zod) degrades to a non-blocking 200 fallback", async () => {
    const ai = new StubImageAi(async () => ({
      items: [{ activity: "x", value: -1, unit: "smoots", co2eKg: 999 }],
    }));
    const res = await handleParseImage(
      postReq(h.uid, { imageBase64: BEEF_SAMPLE, imageMediaType: "image/png" }),
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
    const dayKey = localeDayKey(new Date(), "UTC");
    await h.data.incrementCounter(
      h.uid,
      aiQuotaCounterName(dayKey),
      DEFAULT_DAILY_AI_QUOTA,
    );
    const ai = new StubImageAi(async () => VALID_PARSE);
    const res = await handleParseImage(
      postReq(h.uid, { imageBase64: BEEF_SAMPLE, imageMediaType: "image/png" }),
      h.deps(ai),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe("quota_exceeded");
    expect(ai.imageCalls).toBe(0);
  });

  it("rejects a malformed body (bad media type) as 400, before any AI call", async () => {
    const ai = new StubImageAi(async () => VALID_PARSE);
    const res = await handleParseImage(
      postReq(h.uid, { imageBase64: BEEF_SAMPLE, imageMediaType: "image/gif" }),
      h.deps(ai),
    );
    expect(res.status).toBe(400);
    expect(ai.imageCalls).toBe(0);
  });

  it("the result can NEVER carry a number from the model (only the calculator's)", async () => {
    const ai = new RecordedAiPort();
    const res = await handleParseImage(
      postReq(h.uid, {
        imageBase64: sampleBase64("receipt-grocery.png"),
        imageMediaType: "image/png",
        context: "receipt",
      }),
      h.deps(ai),
    );
    const body = await res.json();
    // Items carry value/confidence (quantities/scores) but NEVER an emission
    // number — no co2e/emission/footprint key anywhere in the payload.
    const flat = JSON.stringify(body).toLowerCase();
    expect(flat).not.toContain("co2");
    expect(flat).not.toContain("emission");
    expect(flat).not.toContain("footprint");
  });
});
