import {
  type CollectionReference,
  type DocumentReference,
  FieldValue,
  type Firestore,
  type Query,
  getFirestore,
} from "firebase-admin/firestore";
import {
  activitySchema,
  baselineSchema,
  goalSchema,
  streakSchema,
  type Activity,
  type Baseline,
  type Goal,
  type Streak,
} from "@core/schemas";
import type {
  ActivityQuery,
  BatchOp,
  BatchResult,
  BatchWrite,
  DataPort,
  MergeSummary,
  UserProfile,
} from "@core/ports";
import { getAdminApp, type GcpAppOptions } from "./app";

const BATCH_LIMIT = 450; // < Firestore's 500-op hard cap, headroom for the receipt.
const STREAK_DOC_ID = "current";
const ALLOWED_BATCH_COLLECTIONS = new Set(["activities", "goals", "counters"]);

interface ReceiptDoc {
  appliedAt: number;
  opsApplied: number;
}

/**
 * Firestore DataPort (ADR-004): keys all data under `users/{uid}` subcollections
 * with server-side authorization (handlers resolve uid from Auth; the security
 * rules are defense-in-depth). `runBatch`/`mergeUserData` use Firestore transactions
 * for atomic, idempotent semantics — the GCP twin of the in-mem adapter.
 */
export class FirestoreDataPort implements DataPort {
  private readonly db: Firestore;

  constructor(appOptions: GcpAppOptions = {}, db?: Firestore) {
    this.db = db ?? getFirestore(getAdminApp(appOptions));
  }

  private userDoc(uid: string): DocumentReference {
    return this.db.collection("users").doc(uid);
  }

  private collection(uid: string, name: string): CollectionReference {
    return this.userDoc(uid).collection(name);
  }

  async getProfile(uid: string): Promise<UserProfile | null> {
    const snap = await this.userDoc(uid).get();
    if (!snap.exists) {
      return null;
    }
    return snap.data() as UserProfile;
  }

  async upsertProfile(profile: UserProfile): Promise<void> {
    await this.userDoc(profile.uid).set(profile, { merge: true });
  }

  async addActivity(uid: string, activity: Activity): Promise<void> {
    await this.collection(uid, "activities").doc(activity.id).set(activity);
  }

  async listActivities(
    uid: string,
    query?: ActivityQuery,
  ): Promise<Activity[]> {
    let q: Query = this.collection(uid, "activities");
    if (query?.category !== undefined) {
      q = q.where("category", "==", query.category);
    }
    if (query?.sinceTs !== undefined) {
      q = q.where("ts", ">=", query.sinceTs);
    }
    if (query?.untilTs !== undefined) {
      q = q.where("ts", "<=", query.untilTs);
    }
    q = q.orderBy("ts", "desc");
    if (query?.limit !== undefined) {
      q = q.limit(query.limit);
    }
    const snap = await q.get();
    return snap.docs.map((d) => activitySchema.parse(d.data()));
  }

  async getBaseline(uid: string): Promise<Baseline | null> {
    const snap = await this.userDoc(uid)
      .collection("baseline")
      .doc("current")
      .get();
    return snap.exists ? baselineSchema.parse(snap.data()) : null;
  }

  async setBaseline(uid: string, baseline: Baseline): Promise<void> {
    await this.userDoc(uid).collection("baseline").doc("current").set(baseline);
  }

  async setGoal(uid: string, goal: Goal): Promise<void> {
    await this.collection(uid, "goals").doc(goal.id).set(goal);
  }

  async listGoals(uid: string): Promise<Goal[]> {
    const snap = await this.collection(uid, "goals").get();
    return snap.docs.map((d) => goalSchema.parse(d.data()));
  }

  async getStreak(uid: string): Promise<Streak | null> {
    const snap = await this.collection(uid, "streaks").doc(STREAK_DOC_ID).get();
    return snap.exists ? streakSchema.parse(snap.data()) : null;
  }

  async setStreak(uid: string, streak: Streak): Promise<void> {
    await this.collection(uid, "streaks").doc(STREAK_DOC_ID).set(streak);
  }

  async getCounter(uid: string, name: string): Promise<number> {
    const snap = await this.collection(uid, "counters").doc(name).get();
    const value = snap.exists ? (snap.data()?.value as unknown) : 0;
    return typeof value === "number" ? value : 0;
  }

  async incrementCounter(
    uid: string,
    name: string,
    by: number,
  ): Promise<number> {
    const ref = this.collection(uid, "counters").doc(name);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current =
        snap.exists && typeof snap.data()?.value === "number"
          ? (snap.data()?.value as number)
          : 0;
      const next = current + by;
      tx.set(
        ref,
        { value: next, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return next;
    });
  }

  /**
   * Atomic, idempotent batched write. A transaction first reads the idempotency
   * receipt (`_batches/{key}`); if present it returns without re-applying. Every
   * op is staged via the transaction, so a mid-batch throw rolls the whole thing
   * back. The receipt is written in the same transaction — all-or-nothing.
   */
  async runBatch(batch: BatchWrite): Promise<BatchResult> {
    if (batch.ops.length > BATCH_LIMIT) {
      throw new Error(
        `Batch of ${batch.ops.length} ops exceeds the ${BATCH_LIMIT}-op boundary; split it.`,
      );
    }
    const receiptRef = this.collection(batch.uid, "_batches").doc(
      batch.idempotencyKey,
    );

    return this.db.runTransaction(async (tx) => {
      const receiptSnap = await tx.get(receiptRef);
      if (receiptSnap.exists) {
        const receipt = receiptSnap.data() as ReceiptDoc;
        return {
          applied: true,
          opsApplied: receipt.opsApplied,
          idempotentReplay: true,
        };
      }

      for (const op of batch.ops) {
        this.applyOp(tx, batch.uid, op);
      }

      const receipt: ReceiptDoc = {
        appliedAt: Date.now(),
        opsApplied: batch.ops.length,
      };
      tx.set(receiptRef, receipt);

      return {
        applied: true,
        opsApplied: batch.ops.length,
        idempotentReplay: false,
      };
    });
  }

  private applyOp(
    tx: FirebaseFirestore.Transaction,
    uid: string,
    op: BatchOp,
  ): void {
    if (!ALLOWED_BATCH_COLLECTIONS.has(op.collection)) {
      throw new Error(
        `Unknown batch collection "${op.collection}". Allowed: activities, goals, counters.`,
      );
    }
    const ref = this.collection(uid, op.collection).doc(op.id);
    switch (op.kind) {
      case "set":
        tx.set(ref, op.data as object);
        break;
      case "merge":
        tx.set(ref, op.data as object, { merge: true });
        break;
      case "delete":
        tx.delete(ref);
        break;
      default: {
        const exhaustive: never = op;
        throw new Error(`Unknown batch op: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  /**
   * Idempotent, atomic merge of a source uid's subcollections into a target.
   * Reads source + target activities/goals/baseline + a merge receipt in one
   * transaction; a present receipt short-circuits (no double-write).
   * Activities/goals are copied ONLY when the target lacks that id (an id
   * collision PRESERVES the target's existing doc, never overwrites) — matching
   * the in-mem twin exactly. The baseline is copied only when the target
   * has none. Respects the batch-size boundary.
   */
  async mergeUserData(
    sourceUid: string,
    targetUid: string,
    idempotencyKey: string,
  ): Promise<MergeSummary> {
    const receiptRef = this.collection(targetUid, "_merges").doc(
      idempotencyKey,
    );
    const sourceActivities = this.collection(sourceUid, "activities");
    const sourceGoals = this.collection(sourceUid, "goals");
    const targetActivities = this.collection(targetUid, "activities");
    const targetGoals = this.collection(targetUid, "goals");
    const sourceBaseline = this.userDoc(sourceUid)
      .collection("baseline")
      .doc("current");
    const targetBaseline = this.userDoc(targetUid)
      .collection("baseline")
      .doc("current");

    return this.db.runTransaction(async (tx) => {
      const receiptSnap = await tx.get(receiptRef);
      if (receiptSnap.exists) {
        const r = receiptSnap.data() as MergeSummary;
        return { ...r, idempotentReplay: true };
      }

      const [
        actSnap,
        goalSnap,
        tgtActSnap,
        tgtGoalSnap,
        srcBaseSnap,
        tgtBaseSnap,
      ] = await Promise.all([
        tx.get(sourceActivities),
        tx.get(sourceGoals),
        tx.get(targetActivities),
        tx.get(targetGoals),
        tx.get(sourceBaseline),
        tx.get(targetBaseline),
      ]);

      const copyCount =
        actSnap.size + goalSnap.size + (srcBaseSnap.exists ? 1 : 0);
      if (copyCount > BATCH_LIMIT) {
        throw new Error(
          `Merge of ${copyCount} docs exceeds the ${BATCH_LIMIT}-op boundary; chunk it.`,
        );
      }

      const existingActivityIds = new Set(tgtActSnap.docs.map((d) => d.id));
      const existingGoalIds = new Set(tgtGoalSnap.docs.map((d) => d.id));

      let copiedActivities = 0;
      for (const doc of actSnap.docs) {
        if (existingActivityIds.has(doc.id)) {
          continue;
        }
        tx.set(targetActivities.doc(doc.id), doc.data());
        copiedActivities += 1;
      }
      let copiedGoals = 0;
      for (const doc of goalSnap.docs) {
        if (existingGoalIds.has(doc.id)) {
          continue;
        }
        tx.set(targetGoals.doc(doc.id), doc.data());
        copiedGoals += 1;
      }
      let copiedBaseline = false;
      if (srcBaseSnap.exists && !tgtBaseSnap.exists) {
        tx.set(targetBaseline, srcBaseSnap.data() as object);
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
}
