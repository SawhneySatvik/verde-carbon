import { describe, it, expect, beforeEach } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import type { Activity, Goal } from "@core/schemas";
import { FirestoreDataPort } from "./data";

/**
 * Minimal in-memory Firestore fake — JUST enough of the transaction surface
 * `mergeUserData` touches (path-addressed docs/collections, `tx.get` over a doc
 * OR a collection, `tx.set`, `runTransaction`). It lets us assert the GCP twin's
 * id-collision behavior matches the in-mem adapter (#4) with ZERO emulator.
 */

interface StoredDoc {
  data: Record<string, unknown>;
}

class FakeStore {
  // Keyed by full slash path, e.g. "users/u/activities/a1".
  readonly docs = new Map<string, StoredDoc>();
}

class FakeDocRef {
  constructor(
    private readonly store: FakeStore,
    readonly path: string,
    readonly id: string,
  ) {}
  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.store, `${this.path}/${name}`);
  }
  async get(): Promise<FakeDocSnap> {
    return this.snap();
  }
  snap(): FakeDocSnap {
    const doc = this.store.docs.get(this.path);
    return new FakeDocSnap(this.id, doc?.data);
  }
}

class FakeDocSnap {
  constructor(
    readonly id: string,
    private readonly _data: Record<string, unknown> | undefined,
  ) {}
  get exists(): boolean {
    return this._data !== undefined;
  }
  data(): Record<string, unknown> | undefined {
    return this._data;
  }
}

class FakeCollectionRef {
  constructor(
    private readonly store: FakeStore,
    readonly path: string,
  ) {}
  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.store, `${this.path}/${id}`, id);
  }
  async get(): Promise<FakeQuerySnap> {
    return this.snap();
  }
  snap(): FakeQuerySnap {
    const prefix = `${this.path}/`;
    const docs: FakeDocSnap[] = [];
    for (const [key, value] of this.store.docs) {
      // Direct children only (no nested subcollections).
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) {
        docs.push(new FakeDocSnap(key.slice(prefix.length), value.data));
      }
    }
    return new FakeQuerySnap(docs);
  }
}

class FakeQuerySnap {
  constructor(readonly docs: FakeDocSnap[]) {}
  get size(): number {
    return this.docs.length;
  }
}

class FakeTransaction {
  constructor(private readonly store: FakeStore) {}
  async get(ref: FakeDocRef | FakeCollectionRef): Promise<unknown> {
    return ref instanceof FakeDocRef ? ref.snap() : ref.snap();
  }
  set(ref: FakeDocRef, data: Record<string, unknown>): void {
    this.store.docs.set(ref.path, { data });
  }
}

class FakeFirestore {
  readonly store = new FakeStore();
  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.store, name);
  }
  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    return fn(new FakeTransaction(this.store));
  }
  seed(path: string, data: Record<string, unknown>): void {
    this.store.docs.set(path, { data });
  }
}

function activity(id: string, co2eKg: number): Activity {
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
    co2eKg,
    source: {
      name: "EPA",
      url: "https://example.com",
      edition: "2025",
      publishedYear: 2025,
    },
    origin: "nl",
  };
}

function goal(id: string, targetPct: number): Goal {
  return {
    id,
    type: "reduction",
    targetPct,
    baselineKg: 100,
    period: "monthly",
    createdAt: 1,
    active: true,
  };
}

describe("FirestoreDataPort.mergeUserData — id collision preserves the target (#4)", () => {
  let fs: FakeFirestore;
  let port: FirestoreDataPort;

  beforeEach(() => {
    fs = new FakeFirestore();
    port = new FirestoreDataPort({}, fs as unknown as Firestore);
  });

  it("skips ids the target already owns (no overwrite) and copies only new ids", async () => {
    // Source (anon) has a1, a2 and goal g1.
    fs.seed("users/anon/activities/a1", { ...activity("a1", 1) });
    fs.seed("users/anon/activities/a2", { ...activity("a2", 2) });
    fs.seed("users/anon/goals/g1", { ...goal("g1", 10) });
    // Target already owns a1 (DIFFERENT value) and g1 (DIFFERENT value).
    fs.seed("users/real/activities/a1", { ...activity("a1", 111) });
    fs.seed("users/real/goals/g1", { ...goal("g1", 99) });

    const summary = await port.mergeUserData("anon", "real", "merge-collide");

    // a1 + g1 collide (skipped); only a2 is new.
    expect(summary.copiedActivities).toBe(1);
    expect(summary.copiedGoals).toBe(0);
    expect(summary.idempotentReplay).toBe(false);

    // The target's colliding docs are PRESERVED, not overwritten.
    expect(fs.store.docs.get("users/real/activities/a1")?.data.co2eKg).toBe(
      111,
    );
    expect(fs.store.docs.get("users/real/goals/g1")?.data.targetPct).toBe(99);
    // a2 was copied across.
    expect(fs.store.docs.get("users/real/activities/a2")?.data.co2eKg).toBe(2);
  });

  it("is idempotent — a replay with the same key does not re-copy", async () => {
    fs.seed("users/anon/activities/a1", { ...activity("a1", 1) });

    const first = await port.mergeUserData("anon", "real", "merge-1");
    expect(first.idempotentReplay).toBe(false);
    expect(first.copiedActivities).toBe(1);

    const replay = await port.mergeUserData("anon", "real", "merge-1");
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.copiedActivities).toBe(1);
  });
});
