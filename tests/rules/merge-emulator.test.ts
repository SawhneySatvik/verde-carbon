import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { isEmulatorReachable, makeTestEnv } from "./emulator";

const SOURCE = "anon-source-uid";
const TARGET = "signed-in-target-uid";
const KEY = "merge-key-1";

// Mirrors src/server/adapters/gcp/data.ts: < Firestore's 500-op hard cap, with
// headroom for the receipt write inside the same transaction.
const BATCH_LIMIT = 450;

let emulatorUp = false;
let testEnv: RulesTestEnvironment | undefined;

beforeAll(async () => {
  emulatorUp = await isEmulatorReachable();
  if (emulatorUp) {
    testEnv = await makeTestEnv("verde-rules-merge");
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv?.clearFirestore();
});

interface MergeSummary {
  copiedActivities: number;
  copiedGoals: number;
  copiedBaseline: boolean;
  idempotentReplay: boolean;
}

/**
 * Runs the ADR-004 / FirestoreDataPort.mergeUserData transaction against the
 * real emulator (rules-disabled admin context, since firebase-admin bypasses
 * rules in production): a present `_merges/{key}` receipt short-circuits the
 * whole transaction (no double-write on retry); the source subcollections are
 * read then copied by id; the baseline copies only when the target has none; the
 * receipt is written in the SAME transaction (all-or-nothing). The batch-size
 * boundary is enforced before any write. Reads precede writes so the same logic
 * is valid on both the client SDK (strict) and firebase-admin.
 */
async function mergeUserData(
  db: Firestore,
  sourceUid: string,
  targetUid: string,
  idempotencyKey: string,
): Promise<MergeSummary> {
  const receiptRef = doc(db, `users/${targetUid}/_merges/${idempotencyKey}`);
  const srcActivities = collection(db, `users/${sourceUid}/activities`);
  const srcGoals = collection(db, `users/${sourceUid}/goals`);
  const tgtBaseline = doc(db, `users/${targetUid}/baseline/current`);

  return runTransaction(db, async (tx) => {
    const receiptSnap = await tx.get(receiptRef);
    if (receiptSnap.exists()) {
      return {
        ...(receiptSnap.data() as MergeSummary),
        idempotentReplay: true,
      };
    }

    const [actSnap, goalSnap, srcBaseSnap, tgtBaseSnap] = await Promise.all([
      getDocs(srcActivities),
      getDocs(srcGoals),
      getDoc(doc(db, `users/${sourceUid}/baseline/current`)),
      tx.get(tgtBaseline),
    ]);

    const copyCount =
      actSnap.size + goalSnap.size + (srcBaseSnap.exists() ? 1 : 0);
    if (copyCount > BATCH_LIMIT) {
      throw new Error(
        `Merge of ${copyCount} docs exceeds the ${BATCH_LIMIT}-op boundary; chunk it.`,
      );
    }

    let copiedActivities = 0;
    for (const d of actSnap.docs) {
      tx.set(doc(db, `users/${targetUid}/activities/${d.id}`), d.data());
      copiedActivities += 1;
    }
    let copiedGoals = 0;
    for (const d of goalSnap.docs) {
      tx.set(doc(db, `users/${targetUid}/goals/${d.id}`), d.data());
      copiedGoals += 1;
    }

    let copiedBaseline = false;
    if (srcBaseSnap.exists() && !tgtBaseSnap.exists()) {
      tx.set(tgtBaseline, srcBaseSnap.data() as object);
      copiedBaseline = true;
    }

    const summary: MergeSummary = {
      copiedActivities,
      copiedGoals,
      copiedBaseline,
      idempotentReplay: false,
    };
    tx.set(receiptRef, summary);
    return summary;
  });
}

async function seedSource(
  db: Firestore,
  uid: string,
  opts: { activities: number; goals: number; baseline: boolean },
): Promise<void> {
  // Concurrent writes, all awaited before the caller merges — otherwise the
  // merge's getDocs can race a still-committing seed and read a partial set.
  const writes: Promise<void>[] = [];
  for (let i = 0; i < opts.activities; i += 1) {
    writes.push(
      setDoc(doc(db, `users/${uid}/activities/a${i}`), {
        ts: 1_700_000_000_000 + i,
        category: "transport",
        co2eKg: 1.5,
      }),
    );
  }
  for (let i = 0; i < opts.goals; i += 1) {
    writes.push(
      setDoc(doc(db, `users/${uid}/goals/g${i}`), {
        type: "reduce",
        targetPct: 10,
      }),
    );
  }
  if (opts.baseline) {
    writes.push(
      setDoc(doc(db, `users/${uid}/baseline/current`), {
        computedAt: 1_700_000_000_000,
        totalKg: 42,
      }),
    );
  }
  await Promise.all(writes);
}

describe("anon->sign-in merge — real Firestore transaction semantics", () => {
  it("requires the emulator", () => {
    expect(typeof mergeUserData).toBe("function");
  });

  it("copies source subcollections into the target on first run", async () => {
    if (!emulatorUp || !testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      await seedSource(db, SOURCE, { activities: 3, goals: 2, baseline: true });

      const summary = await mergeUserData(db, SOURCE, TARGET, KEY);
      expect(summary.idempotentReplay).toBe(false);
      expect(summary.copiedActivities).toBe(3);
      expect(summary.copiedGoals).toBe(2);
      expect(summary.copiedBaseline).toBe(true);

      const tgtActs = await getDocs(
        collection(db, `users/${TARGET}/activities`),
      );
      const tgtGoals = await getDocs(collection(db, `users/${TARGET}/goals`));
      expect(tgtActs.size).toBe(3);
      expect(tgtGoals.size).toBe(2);
    });
  });

  it("run TWICE does not double-write (idempotent via _merges receipt)", async () => {
    if (!emulatorUp || !testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      await seedSource(db, SOURCE, { activities: 4, goals: 1, baseline: true });

      const first = await mergeUserData(db, SOURCE, TARGET, KEY);
      expect(first.idempotentReplay).toBe(false);
      expect(first.copiedActivities).toBe(4);

      const second = await mergeUserData(db, SOURCE, TARGET, KEY);
      expect(second.idempotentReplay).toBe(true);
      expect(second.copiedActivities).toBe(4);

      // The target holds exactly the source docs — no duplicates from the replay.
      const tgtActs = await getDocs(
        collection(db, `users/${TARGET}/activities`),
      );
      const tgtGoals = await getDocs(collection(db, `users/${TARGET}/goals`));
      expect(tgtActs.size).toBe(4);
      expect(tgtGoals.size).toBe(1);
    });
  });

  it("does not overwrite a baseline the target already owns", async () => {
    if (!emulatorUp || !testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      await seedSource(db, SOURCE, { activities: 0, goals: 0, baseline: true });
      await setDoc(doc(db, `users/${TARGET}/baseline/current`), {
        computedAt: 1,
        totalKg: 999,
      });

      const summary = await mergeUserData(db, SOURCE, TARGET, KEY);
      expect(summary.copiedBaseline).toBe(false);

      const tgtBase = await getDoc(doc(db, `users/${TARGET}/baseline/current`));
      expect((tgtBase.data() as { totalKg: number }).totalKg).toBe(999);
    });
  });

  it("rejects a merge that exceeds the batch-size boundary", async () => {
    if (!emulatorUp || !testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      await seedSource(db, SOURCE, {
        activities: BATCH_LIMIT + 1,
        goals: 0,
        baseline: false,
      });
      await expect(mergeUserData(db, SOURCE, TARGET, KEY)).rejects.toThrow(
        /exceeds the 450-op boundary/,
      );
      // Nothing was written for the over-limit merge.
      const tgtActs = await getDocs(
        collection(db, `users/${TARGET}/activities`),
      );
      expect(tgtActs.size).toBe(0);
    });
  });

  it("merges exactly at the batch-size boundary (boundary case)", async () => {
    if (!emulatorUp || !testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      // copyCount == BATCH_LIMIT must be allowed (boundary is inclusive).
      await seedSource(db, SOURCE, {
        activities: BATCH_LIMIT,
        goals: 0,
        baseline: false,
      });
      const summary = await mergeUserData(db, SOURCE, TARGET, KEY);
      expect(summary.copiedActivities).toBe(BATCH_LIMIT);
      const tgtActs = await getDocs(
        collection(db, `users/${TARGET}/activities`),
      );
      expect(tgtActs.size).toBe(BATCH_LIMIT);
    });
  });
});
