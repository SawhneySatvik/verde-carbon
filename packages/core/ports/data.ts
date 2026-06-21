import type {
  Activity,
  Baseline,
  Goal,
  Streak,
  UnitSystem,
  FactorSet,
  Locale,
} from "@core/schemas";

export interface UserProfile {
  uid: string;
  locale: Locale;
  factorSet: FactorSet;
  unitSystem: UnitSystem;
  displayName?: string;
  isAnonymous: boolean;
}

export interface ActivityQuery {
  category?: Activity["category"];
  sinceTs?: number;
  untilTs?: number;
  limit?: number;
}

export type BatchOp =
  | { kind: "set"; collection: string; id: string; data: unknown }
  | { kind: "merge"; collection: string; id: string; data: unknown }
  | { kind: "delete"; collection: string; id: string };

export interface BatchWrite {
  uid: string;
  ops: readonly BatchOp[];
  idempotencyKey: string;
}

export interface BatchResult {
  applied: boolean;
  opsApplied: number;
  idempotentReplay: boolean;
}

export interface MergeSummary {
  copiedActivities: number;
  copiedGoals: number;
  copiedBaseline: boolean;
  idempotentReplay: boolean;
}

export interface DataPort {
  getProfile(uid: string): Promise<UserProfile | null>;
  upsertProfile(profile: UserProfile): Promise<void>;

  addActivity(uid: string, activity: Activity): Promise<void>;
  listActivities(uid: string, query?: ActivityQuery): Promise<Activity[]>;

  getBaseline(uid: string): Promise<Baseline | null>;
  setBaseline(uid: string, baseline: Baseline): Promise<void>;

  setGoal(uid: string, goal: Goal): Promise<void>;
  listGoals(uid: string): Promise<Goal[]>;

  getStreak(uid: string): Promise<Streak | null>;
  setStreak(uid: string, streak: Streak): Promise<void>;

  getCounter(uid: string, name: string): Promise<number>;
  incrementCounter(uid: string, name: string, by: number): Promise<number>;

  /**
   * All-or-nothing batched write. A mid-batch failure rolls back; replaying the
   * same idempotencyKey must not double-write (idempotentReplay = true). The GCP
   * adapter backs this with a Firestore transaction; the in-mem adapter
   * simulates the same atomicity so the merge logic is unit-testable locally.
   */
  runBatch(batch: BatchWrite): Promise<BatchResult>;

  /**
   * Idempotent, atomic merge of one uid's subcollections into another. Running it
   * twice with the same source/target must not double-write (ADR-004).
   */
  mergeUserData(
    sourceUid: string,
    targetUid: string,
    idempotencyKey: string,
  ): Promise<MergeSummary>;
}
