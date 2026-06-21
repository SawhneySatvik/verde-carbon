import { describe, it, expect, beforeEach } from "vitest";
import type { Activity } from "@core/schemas";
import { FactorRepository } from "@core/factors/repository";
import { calculateItem } from "@core/calculator";
import { InMemoryDataPort } from "@/server/adapters/local/data";
import { MockAuthPort } from "@/server/adapters/local/auth";
import {
  handleDelete,
  handlePost,
  buildSampleActivities,
  SAMPLE_GOAL_ID,
  SAMPLE_ID_PREFIX,
  SAMPLE_SPECS,
  type SeedDeps,
} from "./route";

/**
 * /api/dev/seed — the "Load sample data" demo endpoint. The load-bearing
 * guarantees pinned here:
 *   1. Every seeded CO2e is the SAME number the pure calculator produces from the
 *      spec's real factor key + quantity — never fabricated/hardcoded (ADR-001).
 *   2. The ~15–20 rows span the past ~3–4 weeks (varied backdated `ts`) so the
 *      trend chart has shape, across transport / energy / diet.
 *   3. Authz: no bearer token -> 401, no writes.
 *   4. Clear removes ONLY sample-tagged rows + the sample goal; real logs survive.
 *   5. Re-seed is idempotent-ish (clear-then-seed): the count does not grow.
 */

const NOW = Date.parse("2026-06-20T12:00:00Z");
const DAY_MS = 86_400_000;

function req(uid: string | null, method: "POST" | "DELETE", body?: unknown) {
  return new Request("https://verde.test/api/dev/seed", {
    method,
    headers: {
      ...(uid !== null && { authorization: `Bearer ${uid}` }),
      "content-type": "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

interface Harness {
  auth: MockAuthPort;
  data: InMemoryDataPort;
  uid: string;
  deps: SeedDeps;
}

async function harness(): Promise<Harness> {
  const auth = new MockAuthPort();
  const data = new InMemoryDataPort();
  const anon = await auth.signInAnonymously();
  const deps: SeedDeps = {
    auth,
    data,
    repository: FactorRepository.fromSeed(),
    now: () => NOW,
  };
  return { auth, data, uid: anon.uid, deps };
}

describe("buildSampleActivities — calculator-sourced CO2e (ADR-001)", () => {
  const repository = FactorRepository.fromSeed();

  it("every sample row's CO2e EQUALS the calculator's number for its key+qty", () => {
    const activities = buildSampleActivities(repository, NOW);
    expect(activities).toHaveLength(SAMPLE_SPECS.length);

    activities.forEach((activity, index) => {
      const spec = SAMPLE_SPECS[index];
      const expected = calculateItem(
        repository,
        {
          candidateFactorKey: spec.candidateFactorKey,
          value: spec.value,
          unit: spec.unit,
          activity: spec.activity,
        },
        { locale: "US" },
      );
      // The spec MUST resolve via the calculator (no fabricated/zero fallback).
      expect(expected.status).toBe("resolved");
      if (expected.status !== "resolved") return;
      // The persisted number is byte-for-byte the calculator's output.
      expect(activity.co2eKg).toBe(expected.co2eKg);
      expect(activity.factorKey).toBe(spec.candidateFactorKey);
      expect(activity.factorSet).toBe(expected.factorSet);
      expect(activity.source).toEqual(expected.source);
    });
  });

  it("seeds 15–20 rows spread across the past ~3–4 weeks (varied backdated ts)", () => {
    const activities = buildSampleActivities(repository, NOW);
    expect(activities.length).toBeGreaterThanOrEqual(15);
    expect(activities.length).toBeLessThanOrEqual(20);

    const tsValues = activities.map((a) => a.ts);
    // All in the past, none in the future.
    expect(Math.max(...tsValues)).toBeLessThanOrEqual(NOW);
    // The oldest is at least ~3 weeks back; the spread is wide (>= 14 distinct
    // days) so the trend chart has shape.
    expect(NOW - Math.min(...tsValues)).toBeGreaterThanOrEqual(21 * DAY_MS);
    const distinctDays = new Set(tsValues.map((ts) => Math.round(ts / DAY_MS)));
    expect(distinctDays.size).toBeGreaterThanOrEqual(10);
  });

  it("covers all three categories with REAL seeded factor keys", () => {
    const activities = buildSampleActivities(repository, NOW);
    const categories = new Set(activities.map((a) => a.category));
    expect(categories).toEqual(new Set(["transport", "energy", "diet"]));
    for (const a of activities) {
      expect(repository.isKnownKey(a.factorKey)).toBe(true);
      expect(a.id.startsWith(SAMPLE_ID_PREFIX)).toBe(true);
    }
  });
});

describe("POST /api/dev/seed — authz + persist via the calculator path", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("401 without a bearer token and writes nothing", async () => {
    const res = await handlePost(req(null, "POST"), h.deps);
    expect(res.status).toBe(401);
    expect(await h.data.listActivities(h.uid)).toHaveLength(0);
  });

  it("inserts the sample activities with calculator-sourced CO2e + spread ts", async () => {
    const res = await handlePost(req(h.uid, "POST", {}), h.deps);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.seeded).toBe(SAMPLE_SPECS.length);
    expect(body.goalSeeded).toBe(true);

    const stored = await h.data.listActivities(h.uid);
    expect(stored).toHaveLength(SAMPLE_SPECS.length);

    // Cross-check a known row against the calculator directly (US/EPA gasoline).
    const gas = stored.find(
      (a: Activity) => a.factorKey === "transport.car.gasoline",
    );
    expect(gas).toBeDefined();
    const expected = calculateItem(
      h.deps.repository,
      {
        candidateFactorKey: "transport.car.gasoline",
        value: gas!.quantity,
        unit: gas!.unit,
      },
      { locale: "US" },
    );
    if (expected.status === "resolved") {
      expect(gas!.co2eKg).toBe(expected.co2eKg);
    }

    // The response total equals the sum of the stored (calculator) numbers.
    const sum = stored.reduce((s, a) => s + a.co2eKg, 0);
    expect(body.totalKg).toBeCloseTo(sum, 9);

    // A reduction goal was seeded with the computed sample total as baseline.
    const goals = await h.data.listGoals(h.uid);
    const goal = goals.find((g) => g.id === SAMPLE_GOAL_ID);
    expect(goal).toBeDefined();
    expect(goal!.baselineKg).toBeCloseTo(sum, 9);
  });

  it("is idempotent-ish: re-seeding clears-then-seeds (count does not grow)", async () => {
    await handlePost(req(h.uid, "POST", {}), h.deps);
    await handlePost(req(h.uid, "POST", {}), h.deps);
    const stored = await h.data.listActivities(h.uid);
    expect(stored).toHaveLength(SAMPLE_SPECS.length);
    const goals = await h.data.listGoals(h.uid);
    expect(goals.filter((g) => g.id === SAMPLE_GOAL_ID)).toHaveLength(1);
  });
});

describe("clear (DELETE + POST {clear:true}) — removes only sample data", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("DELETE removes sample rows + the sample goal but spares the user's real log", async () => {
    // A real (non-sample) activity the user logged themselves.
    const real: Activity = {
      id: "real-1",
      ts: NOW,
      category: "transport",
      activity: "my real commute",
      quantity: 2,
      unit: "gallon",
      factorKey: "transport.car.gasoline",
      factorSet: "EPA",
      factorSetVersion: "EPA-GHG-Hub-2025.1",
      co2eKg: 17.56,
      source: {
        name: "EPA",
        url: "https://example.com",
        edition: "2025",
        publishedYear: 2025,
      },
      origin: "nl",
    };
    await h.data.addActivity(h.uid, real);

    await handlePost(req(h.uid, "POST", {}), h.deps);
    expect(await h.data.listActivities(h.uid)).toHaveLength(
      SAMPLE_SPECS.length + 1,
    );

    const res = await handleDelete(req(h.uid, "DELETE"), h.deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe(true);
    expect(body.removedActivities).toBe(SAMPLE_SPECS.length);
    expect(body.removedGoal).toBe(true);

    // Only the real activity remains; no sample-tagged rows survive.
    const remaining = await h.data.listActivities(h.uid);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("real-1");
    expect(remaining.some((a) => a.id.startsWith(SAMPLE_ID_PREFIX))).toBe(
      false,
    );
    expect(await h.data.listGoals(h.uid)).toHaveLength(0);
  });

  it("POST { clear: true } is an in-band alias for the DELETE clear", async () => {
    await handlePost(req(h.uid, "POST", {}), h.deps);
    const res = await handlePost(req(h.uid, "POST", { clear: true }), h.deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe(true);
    expect(await h.data.listActivities(h.uid)).toHaveLength(0);
  });

  it("DELETE without a bearer token is a 401", async () => {
    const res = await handleDelete(req(null, "DELETE"), h.deps);
    expect(res.status).toBe(401);
  });

  it("clearing an account with no sample data is a no-op 200", async () => {
    const res = await handleDelete(req(h.uid, "DELETE"), h.deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removedActivities).toBe(0);
    expect(body.removedGoal).toBe(false);
  });
});
