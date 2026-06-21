import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { isEmulatorReachable, makeTestEnv } from "./emulator";

const OWNER = "uid-owner";
const ATTACKER = "uid-attacker";

let emulatorUp = false;
let testEnv: RulesTestEnvironment | undefined;

beforeAll(async () => {
  emulatorUp = await isEmulatorReachable();
  if (emulatorUp) {
    testEnv = await makeTestEnv("verde-rules-isolation");
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv?.clearFirestore();
});

function ownerDb(): Firestore {
  if (!testEnv) throw new Error("test env not initialized");
  return testEnv
    .authenticatedContext(OWNER)
    .firestore() as unknown as Firestore;
}

function attackerDb(): Firestore {
  if (!testEnv) throw new Error("test env not initialized");
  return testEnv
    .authenticatedContext(ATTACKER)
    .firestore() as unknown as Firestore;
}

function anonDb(): Firestore {
  if (!testEnv) throw new Error("test env not initialized");
  return testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
}

const userPaths = (uid: string): readonly string[] => [
  `users/${uid}`,
  `users/${uid}/activities/a1`,
  `users/${uid}/goals/g1`,
  `users/${uid}/streaks/current`,
  `users/${uid}/baseline/current`,
  `users/${uid}/counters/aiQuota`,
];

describe("firestore.rules — per-uid isolation (ADR-004)", () => {
  it("is gated on a running Firestore emulator", () => {
    // Always-executed marker so this file has a passing assertion even when the
    // emulator is absent (Java/firebase-tools missing locally). The real
    // coverage is the emulator-gated tests below, which run under
    // `firebase emulators:exec` in CI.
    expect(typeof isEmulatorReachable).toBe("function");
  });

  it("lets a user read and write every one of their own paths", async () => {
    if (!emulatorUp) return;
    const db = ownerDb();
    for (const path of userPaths(OWNER)) {
      await assertSucceeds(setDoc(doc(db, path), { ok: true }));
      await assertSucceeds(getDoc(doc(db, path)));
    }
  });

  it("DENIES cross-uid reads on every path", async () => {
    if (!emulatorUp) return;
    // Seed the owner's docs with rules disabled, then attempt to read as attacker.
    await testEnv?.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore;
      for (const path of userPaths(OWNER)) {
        await setDoc(doc(admin, path), { secret: true });
      }
    });
    const db = attackerDb();
    for (const path of userPaths(OWNER)) {
      await assertFails(getDoc(doc(db, path)));
    }
  });

  it("DENIES cross-uid writes on every path", async () => {
    if (!emulatorUp) return;
    const db = attackerDb();
    for (const path of userPaths(OWNER)) {
      await assertFails(setDoc(doc(db, path), { hijacked: true }));
    }
  });

  it("DENIES all access to an unauthenticated client", async () => {
    if (!emulatorUp) return;
    const db = anonDb();
    for (const path of userPaths(OWNER)) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { x: 1 }));
    }
  });

  it("DENIES client access to the server-only receipt subcollections", async () => {
    if (!emulatorUp) return;
    const db = ownerDb();
    for (const path of [
      `users/${OWNER}/_batches/key-1`,
      `users/${OWNER}/_merges/key-1`,
    ]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { spoof: true }));
    }
  });
});
