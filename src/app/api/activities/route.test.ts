import { describe, it, expect, beforeEach } from "vitest";
import type { Activity } from "@core/schemas";
import type { ActivityQuery, DataPort } from "@core/ports";
import { FactorRepository } from "@core/factors/repository";
import { InMemoryDataPort } from "@/server/adapters/local/data";
import { MockAuthPort } from "@/server/adapters/local/auth";
import {
  handleGet,
  handlePost,
  sanitizeText,
  type ActivitiesDeps,
} from "./route";

/**
 * A DataPort wrapper that COUNTS every write op, so the preview path can be
 * asserted to perform ZERO writes ("show before save").
 */
class CountingDataPort implements DataPort {
  public writes = 0;
  constructor(private readonly inner: DataPort) {}

  async getProfile(uid: string) {
    return this.inner.getProfile(uid);
  }
  async upsertProfile(profile: Parameters<DataPort["upsertProfile"]>[0]) {
    this.writes += 1;
    return this.inner.upsertProfile(profile);
  }
  async addActivity(uid: string, activity: Activity) {
    this.writes += 1;
    return this.inner.addActivity(uid, activity);
  }
  async listActivities(uid: string, query?: ActivityQuery) {
    return this.inner.listActivities(uid, query);
  }
  async getBaseline(uid: string) {
    return this.inner.getBaseline(uid);
  }
  async setBaseline(
    uid: string,
    baseline: Parameters<DataPort["setBaseline"]>[1],
  ) {
    this.writes += 1;
    return this.inner.setBaseline(uid, baseline);
  }
  async setGoal(uid: string, goal: Parameters<DataPort["setGoal"]>[1]) {
    this.writes += 1;
    return this.inner.setGoal(uid, goal);
  }
  async listGoals(uid: string) {
    return this.inner.listGoals(uid);
  }
  async getStreak(uid: string) {
    return this.inner.getStreak(uid);
  }
  async setStreak(uid: string, streak: Parameters<DataPort["setStreak"]>[1]) {
    this.writes += 1;
    return this.inner.setStreak(uid, streak);
  }
  async getCounter(uid: string, name: string) {
    return this.inner.getCounter(uid, name);
  }
  async incrementCounter(uid: string, name: string, by: number) {
    this.writes += 1;
    return this.inner.incrementCounter(uid, name, by);
  }
  async runBatch(batch: Parameters<DataPort["runBatch"]>[0]) {
    this.writes += 1;
    return this.inner.runBatch(batch);
  }
  async mergeUserData(...args: Parameters<DataPort["mergeUserData"]>) {
    this.writes += 1;
    return this.inner.mergeUserData(...args);
  }
}

function req(uid: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${uid}`,
      "content-type": "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

interface Harness {
  auth: MockAuthPort;
  data: CountingDataPort;
  inner: InMemoryDataPort;
  uid: string;
  deps: ActivitiesDeps;
}

async function harness(): Promise<Harness> {
  const auth = new MockAuthPort();
  const inner = new InMemoryDataPort();
  const data = new CountingDataPort(inner);
  const anon = await auth.signInAnonymously();
  const deps: ActivitiesDeps = {
    auth,
    data,
    repository: FactorRepository.fromSeed(),
    now: () => 1_700_000_000_000,
  };
  return { auth, data, inner, uid: anon.uid, deps };
}

describe("sanitizeText", () => {
  it("escapes HTML-significant characters and trims", () => {
    expect(sanitizeText("  <script>alert('x')</script>  ")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
    expect(sanitizeText("a & b")).toBe("a &amp; b");
  });
});

describe("POST /api/activities — calculator-only CO2e + persist", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("401 without a bearer token", async () => {
    const res = await handlePost(
      new Request("https://verde.test/api/activities", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      }),
      h.deps,
    );
    expect(res.status).toBe(401);
    expect(h.data.writes).toBe(0);
  });

  it("computes CO2e via the calculator and persists (US/EPA: 1 gal gasoline = 8.78 kg)", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities", {
        items: [
          {
            category: "transport",
            activity: "drove",
            value: 1,
            unit: "gallon",
            candidateFactorKey: "transport.car.gasoline",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.partial).toBe(false);
    expect(body.persisted).toHaveLength(1);
    expect(body.persisted[0].co2eKg).toBeCloseTo(8.78, 5);
    expect(body.totalKg).toBeCloseTo(8.78, 5);

    const stored = await h.inner.listActivities(h.uid);
    expect(stored).toHaveLength(1);
    expect(stored[0].co2eKg).toBeCloseTo(8.78, 5);
    expect(stored[0].factorKey).toBe("transport.car.gasoline");
  });

  it("SANITIZES free-text activity on store: no raw markup is persisted", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities", {
        items: [
          {
            category: "transport",
            activity: "<img src=x onerror=alert(1)>drove",
            value: 1,
            unit: "gallon",
            candidateFactorKey: "transport.car.gasoline",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    expect(res.status).toBe(201);
    const stored = await h.inner.listActivities(h.uid);
    expect(stored[0].activity).not.toContain("<");
    expect(stored[0].activity).not.toContain(">");
    expect(stored[0].activity).toContain("&lt;img");
  });

  it("REJECTS a phantom `notes` field (strict schema, no silent drop)", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities", {
        items: [
          {
            category: "transport",
            activity: "drove",
            notes: "note <b>bold</b>",
            value: 1,
            unit: "gallon",
            candidateFactorKey: "transport.car.gasoline",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    expect(res.status).toBe(400);
    expect(h.data.writes).toBe(0);
  });

  it("REJECTS a non-positive value (400), not swallowed into unsourced — #6", async () => {
    for (const value of [0, -5]) {
      const res = await handlePost(
        req(h.uid, "https://verde.test/api/activities", {
          items: [
            {
              category: "transport",
              activity: "drove",
              value,
              unit: "gallon",
              candidateFactorKey: "transport.car.gasoline",
            },
          ],
          locale: "US",
        }),
        h.deps,
      );
      expect(res.status).toBe(400);
    }
    expect(h.data.writes).toBe(0);
  });

  it("REJECTS an over-max value (400) for parity with the domain schema — #6", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities", {
        items: [
          {
            category: "transport",
            activity: "drove",
            value: 1_000_001,
            unit: "gallon",
            candidateFactorKey: "transport.car.gasoline",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    expect(res.status).toBe(400);
    expect(h.data.writes).toBe(0);
  });

  it("PARTIAL-RESOLVE: a 2-item set with one UNSOURCED item totals only the sourced item and persists only it", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities", {
        items: [
          {
            category: "transport",
            activity: "drove",
            value: 1,
            unit: "gallon",
            candidateFactorKey: "transport.car.gasoline",
          },
          {
            category: "diet",
            activity: "unicorn steak",
            value: 1,
            unit: "meal",
            candidateFactorKey: "diet.meal.unknown",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.partial).toBe(true);
    expect(body.persisted).toHaveLength(1);
    expect(body.unsourced).toHaveLength(1);
    expect(body.unsourced[0].reason).toBe("unknown-key");
    // Total reflects ONLY the sourced item — the unsourced one is excluded.
    expect(body.totalKg).toBeCloseTo(8.78, 5);

    const stored = await h.inner.listActivities(h.uid);
    expect(stored).toHaveLength(1);
    expect(stored[0].factorKey).toBe("transport.car.gasoline");
  });

  it("rejects a structurally invalid body (400) with no writes", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities", {
        items: [{ category: "transport", value: 1 }],
      }),
      h.deps,
    );
    expect(res.status).toBe(400);
    expect(h.data.writes).toBe(0);
  });
});

describe("POST /api/activities?preview=1 — compute-without-persist", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("returns the breakdown with ZERO DataPort writes", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities?preview=1", {
        items: [
          {
            category: "transport",
            activity: "drove",
            value: 1,
            unit: "gallon",
            candidateFactorKey: "transport.car.gasoline",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.totalKg).toBeCloseTo(8.78, 5);
    expect(body.preview.rows[0].status).toBe("resolved");

    // The load-bearing assertion: NOTHING was written.
    expect(h.data.writes).toBe(0);
    expect(await h.inner.listActivities(h.uid)).toHaveLength(0);
  });

  it("preview STILL passes authz (401 without a token) and makes no writes", async () => {
    const res = await handlePost(
      new Request("https://verde.test/api/activities?preview=1", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      }),
      h.deps,
    );
    expect(res.status).toBe(401);
    expect(h.data.writes).toBe(0);
  });

  it("preview surfaces an unsourced item without writing it", async () => {
    const res = await handlePost(
      req(h.uid, "https://verde.test/api/activities?preview=1", {
        items: [
          {
            category: "diet",
            activity: "unicorn steak",
            value: 1,
            unit: "meal",
            candidateFactorKey: "diet.meal.unknown",
          },
        ],
        locale: "US",
      }),
      h.deps,
    );
    const body = await res.json();
    expect(body.preview.hasUnsourced).toBe(true);
    expect(body.preview.unsourcedCount).toBe(1);
    expect(h.data.writes).toBe(0);
  });
});

describe("GET /api/activities — shaped (category,ts)/(ts) queries", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
    // the in-mem local adapter needs NO indexes; the (category,ts)/(ts)
    // composite indexes are a GCP-only deploy artifact validated at deploy time.
    await h.inner.addActivity(h.uid, {
      id: "a1",
      ts: 100,
      category: "transport",
      activity: "drove",
      quantity: 1,
      unit: "gallon",
      factorKey: "transport.car.gasoline",
      factorSet: "EPA",
      factorSetVersion: "EPA-GHG-Hub-2025.1",
      co2eKg: 8.78,
      source: {
        name: "EPA",
        url: "https://example.com",
        edition: "2025",
        publishedYear: 2025,
      },
      origin: "nl",
    });
    await h.inner.addActivity(h.uid, {
      id: "a2",
      ts: 200,
      category: "diet",
      activity: "beef burger",
      quantity: 1,
      unit: "meal",
      factorKey: "diet.meal.beef",
      factorSet: "EPA",
      factorSetVersion: "EPA-GHG-Hub-2025.1",
      co2eKg: 6.61,
      source: {
        name: "EPA",
        url: "https://example.com",
        edition: "2025",
        publishedYear: 2025,
      },
      origin: "nl",
    });
  });

  it("lists all activities newest-first ((ts) query)", async () => {
    const res = await handleGet(
      req(h.uid, "https://verde.test/api/activities"),
      h.deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities.map((a: Activity) => a.id)).toEqual(["a2", "a1"]);
  });

  it("filters by category ((category,ts) query)", async () => {
    const res = await handleGet(
      req(h.uid, "https://verde.test/api/activities?category=transport"),
      h.deps,
    );
    const body = await res.json();
    expect(body.activities).toHaveLength(1);
    expect(body.activities[0].id).toBe("a1");
  });

  it("rejects an inverted time window (400)", async () => {
    const res = await handleGet(
      req(h.uid, "https://verde.test/api/activities?sinceTs=300&untilTs=100"),
      h.deps,
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown category value (400)", async () => {
    const res = await handleGet(
      req(h.uid, "https://verde.test/api/activities?category=bogus"),
      h.deps,
    );
    expect(res.status).toBe(400);
  });
});
