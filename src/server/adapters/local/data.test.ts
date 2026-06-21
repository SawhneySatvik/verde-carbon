import { describe, it, expect, beforeEach } from "vitest";
import type { Activity, Baseline, Goal, Streak } from "@core/schemas";
import type { BatchWrite, UserProfile } from "@core/ports";
import { InMemoryDataPort } from "./data";
import { MockAuthPort } from "./auth";
import { EnvSecretsPort } from "./secrets";

function activity(id: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    ts: 1_700_000_000_000,
    category: "transport",
    activity: "drove",
    quantity: 20,
    unit: "km",
    factorKey: "transport.car.gasoline",
    factorSet: "EPA",
    factorSetVersion: "epa-2025.1",
    co2eKg: 4.2,
    source: {
      name: "EPA GHG Emission Factors Hub",
      url: "https://www.epa.gov/climateleadership",
      edition: "2025",
      publishedYear: 2025,
    },
    origin: "nl",
    ...overrides,
  };
}

function profile(uid: string): UserProfile {
  return {
    uid,
    locale: "US",
    factorSet: "EPA",
    unitSystem: "imperial",
    isAnonymous: true,
  };
}

describe("InMemoryDataPort — uid-keyed subcollections (ADR-004)", () => {
  let data: InMemoryDataPort;

  beforeEach(() => {
    data = new InMemoryDataPort();
  });

  it("isolates data per uid", async () => {
    await data.addActivity("uid-a", activity("a1"));
    await data.addActivity("uid-b", activity("b1"));
    expect(await data.listActivities("uid-a")).toHaveLength(1);
    expect(await data.listActivities("uid-b")).toHaveLength(1);
    expect((await data.listActivities("uid-a"))[0]?.id).toBe("a1");
  });

  it("round-trips profile, baseline, goal, streak", async () => {
    await data.upsertProfile(profile("uid-a"));
    const baseline: Baseline = {
      computedAt: 1,
      totalKg: 10,
      factorSet: "EPA",
      unitSystem: "imperial",
      lineItems: [],
    };
    const goal: Goal = {
      id: "g1",
      type: "reduction",
      targetPct: 10,
      baselineKg: 100,
      period: "monthly",
      createdAt: 1,
      active: true,
    };
    const streak: Streak = {
      count: 3,
      lastLoggedDate: "2026-06-20",
      longest: 5,
    };
    await data.setBaseline("uid-a", baseline);
    await data.setGoal("uid-a", goal);
    await data.setStreak("uid-a", streak);

    expect(await data.getProfile("uid-a")).toEqual(profile("uid-a"));
    expect(await data.getBaseline("uid-a")).toEqual(baseline);
    expect(await data.listGoals("uid-a")).toEqual([goal]);
    expect(await data.getStreak("uid-a")).toEqual(streak);
  });

  it("returns deep clones so callers cannot mutate the store", async () => {
    await data.addActivity("uid-a", activity("a1"));
    const list = await data.listActivities("uid-a");
    list[0]!.co2eKg = 999;
    const again = await data.listActivities("uid-a");
    expect(again[0]?.co2eKg).toBe(4.2);
  });

  it("filters activities by category and time and sorts newest-first", async () => {
    await data.addActivity(
      "uid-a",
      activity("a1", { ts: 100, category: "transport" }),
    );
    await data.addActivity(
      "uid-a",
      activity("a2", { ts: 200, category: "diet" }),
    );
    await data.addActivity(
      "uid-a",
      activity("a3", { ts: 300, category: "transport" }),
    );

    const transport = await data.listActivities("uid-a", {
      category: "transport",
    });
    expect(transport.map((a) => a.id)).toEqual(["a3", "a1"]);

    const windowed = await data.listActivities("uid-a", {
      sinceTs: 150,
      untilTs: 250,
    });
    expect(windowed.map((a) => a.id)).toEqual(["a2"]);

    const limited = await data.listActivities("uid-a", { limit: 1 });
    expect(limited.map((a) => a.id)).toEqual(["a3"]);
  });
});

describe("InMemoryDataPort — daily AI-quota counter doc", () => {
  it("starts at 0 and increments persistently", async () => {
    const data = new InMemoryDataPort();
    expect(await data.getCounter("uid-a", "ai:2026-06-20")).toBe(0);
    expect(await data.incrementCounter("uid-a", "ai:2026-06-20", 1)).toBe(1);
    expect(await data.incrementCounter("uid-a", "ai:2026-06-20", 1)).toBe(2);
    expect(await data.getCounter("uid-a", "ai:2026-06-20")).toBe(2);
  });

  it("keeps counters separate per uid and per day key", async () => {
    const data = new InMemoryDataPort();
    await data.incrementCounter("uid-a", "ai:2026-06-20", 5);
    expect(await data.getCounter("uid-b", "ai:2026-06-20")).toBe(0);
    expect(await data.getCounter("uid-a", "ai:2026-06-21")).toBe(0);
  });
});

describe("InMemoryDataPort.runBatch — ATOMIC all-or-nothing + idempotent", () => {
  let data: InMemoryDataPort;

  beforeEach(() => {
    data = new InMemoryDataPort();
  });

  it("applies every op when all are valid", async () => {
    const batch: BatchWrite = {
      uid: "uid-a",
      idempotencyKey: "k1",
      ops: [
        {
          kind: "set",
          collection: "activities",
          id: "a1",
          data: activity("a1"),
        },
        {
          kind: "set",
          collection: "activities",
          id: "a2",
          data: activity("a2"),
        },
      ],
    };
    const result = await data.runBatch(batch);
    expect(result.applied).toBe(true);
    expect(result.opsApplied).toBe(2);
    expect(result.idempotentReplay).toBe(false);
    expect(await data.listActivities("uid-a")).toHaveLength(2);
  });

  it("ROLLS BACK on a mid-batch failure — no partial write", async () => {
    await data.addActivity("uid-a", activity("a0"));
    const batch: BatchWrite = {
      uid: "uid-a",
      idempotencyKey: "k-bad",
      ops: [
        {
          kind: "set",
          collection: "activities",
          id: "a1",
          data: activity("a1"),
        },
        // Unknown collection forces a mid-batch throw AFTER a1 was staged.
        { kind: "set", collection: "nope", id: "x", data: {} },
      ],
    };
    await expect(data.runBatch(batch)).rejects.toThrow(
      /Unknown batch collection/,
    );
    // a1 must NOT have been written; only the pre-existing a0 remains.
    const ids = (await data.listActivities("uid-a")).map((a) => a.id);
    expect(ids).toEqual(["a0"]);
  });

  it("is idempotent — replaying the same key does NOT double-write", async () => {
    const batch: BatchWrite = {
      uid: "uid-a",
      idempotencyKey: "k-same",
      ops: [{ kind: "set", collection: "goals", id: "g1", data: { id: "g1" } }],
    };
    const first = await data.runBatch(batch);
    const second = await data.runBatch(batch);
    expect(first.idempotentReplay).toBe(false);
    expect(second.idempotentReplay).toBe(true);
    expect(second.opsApplied).toBe(first.opsApplied);
    expect(await data.listGoals("uid-a")).toHaveLength(1);
  });
});

describe("InMemoryDataPort.mergeUserData — atomic + idempotent", () => {
  let data: InMemoryDataPort;

  beforeEach(async () => {
    data = new InMemoryDataPort();
    await data.addActivity("anon", activity("a1"));
    await data.addActivity("anon", activity("a2"));
    await data.setGoal("anon", {
      id: "g1",
      type: "reduction",
      targetPct: 10,
      baselineKg: 100,
      period: "monthly",
      createdAt: 1,
      active: true,
    });
    await data.setBaseline("anon", {
      computedAt: 1,
      totalKg: 10,
      factorSet: "EPA",
      unitSystem: "imperial",
      lineItems: [],
    });
  });

  it("copies subcollections into the target uid", async () => {
    const summary = await data.mergeUserData("anon", "real", "merge-1");
    expect(summary.copiedActivities).toBe(2);
    expect(summary.copiedGoals).toBe(1);
    expect(summary.copiedBaseline).toBe(true);
    expect(summary.idempotentReplay).toBe(false);
    expect(await data.listActivities("real")).toHaveLength(2);
    expect(await data.listGoals("real")).toHaveLength(1);
    expect(await data.getBaseline("real")).not.toBeNull();
  });

  it("running the merge TWICE must not double-write", async () => {
    await data.mergeUserData("anon", "real", "merge-1");
    const replay = await data.mergeUserData("anon", "real", "merge-1");
    expect(replay.idempotentReplay).toBe(true);
    expect(await data.listActivities("real")).toHaveLength(2);
    expect(await data.listGoals("real")).toHaveLength(1);
  });

  it("does not overwrite an existing target baseline", async () => {
    await data.setBaseline("real", {
      computedAt: 99,
      totalKg: 500,
      factorSet: "DEFRA_DESNZ",
      unitSystem: "metric",
      lineItems: [],
    });
    const summary = await data.mergeUserData("anon", "real", "merge-keep");
    expect(summary.copiedBaseline).toBe(false);
    expect((await data.getBaseline("real"))?.totalKg).toBe(500);
  });

  it("on an id COLLISION preserves the target doc and does not copy it (#4)", async () => {
    // The target already owns id "a1" with a DIFFERENT value than the source.
    await data.addActivity("real", activity("a1", { co2eKg: 111 }));
    await data.setGoal("real", {
      id: "g1",
      type: "reduction",
      targetPct: 99,
      baselineKg: 1,
      period: "yearly",
      createdAt: 2,
      active: false,
    });

    const summary = await data.mergeUserData("anon", "real", "merge-collide");
    // a1 collides (skipped) — only a2 is new; g1 collides (skipped) — 0 copied.
    expect(summary.copiedActivities).toBe(1);
    expect(summary.copiedGoals).toBe(0);

    // The target's a1 is PRESERVED (the source's a1 did not overwrite it).
    const real = await data.listActivities("real");
    expect(real.find((a) => a.id === "a1")?.co2eKg).toBe(111);
    expect(real.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect((await data.listGoals("real"))[0]?.targetPct).toBe(99);
  });
});

describe("MockAuthPort — anonymous-first + linkWithCredential", () => {
  it("mints distinct anonymous uids", async () => {
    const auth = new MockAuthPort();
    const a = await auth.signInAnonymously();
    const b = await auth.signInAnonymously();
    expect(a.isAnonymous).toBe(true);
    expect(a.uid).not.toBe(b.uid);
  });

  it("links and PRESERVES the uid (no migration on the happy path)", async () => {
    const auth = new MockAuthPort();
    const anon = await auth.signInAnonymously();
    const result = await auth.linkWithCredential(anon.uid, {
      provider: "google.com",
      token: "tok-1",
    });
    expect(result.status).toBe("linked");
    if (result.status === "linked") {
      expect(result.identity.uid).toBe(anon.uid);
      expect(result.identity.isAnonymous).toBe(false);
    }
  });

  it("returns credential-already-in-use when the credential is bound elsewhere", async () => {
    const auth = new MockAuthPort({
      credentials: [
        {
          credential: { provider: "google.com", token: "tok-1" },
          uid: "existing-uid",
        },
      ],
    });
    const anon = await auth.signInAnonymously();
    const result = await auth.linkWithCredential(anon.uid, {
      provider: "google.com",
      token: "tok-1",
    });
    expect(result.status).toBe("credential-already-in-use");
    if (result.status === "credential-already-in-use") {
      expect(result.existingUid).toBe("existing-uid");
    }
    // The anon account is left intact for keep-vs-merge.
    expect((await auth.getCurrentIdentity(anon.uid))?.isAnonymous).toBe(true);
  });
});

describe("EnvSecretsPort — process-env / .env.local", () => {
  it("reads a present secret and reports has()", async () => {
    const secrets = new EnvSecretsPort({ GEMINI_API_KEY: "abc" });
    expect(await secrets.has("GEMINI_API_KEY")).toBe(true);
    expect(await secrets.get("GEMINI_API_KEY")).toBe("abc");
  });

  it("has() is false and get() throws for a missing/empty secret", async () => {
    const secrets = new EnvSecretsPort({ GEMINI_API_KEY: "" });
    expect(await secrets.has("GEMINI_API_KEY")).toBe(false);
    await expect(secrets.get("GEMINI_API_KEY")).rejects.toThrow(
      /Missing secret/,
    );
  });
});
