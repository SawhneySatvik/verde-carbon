import type { Activity, Baseline, Goal, Streak } from "@core/schemas";
import type {
  ActivityQuery,
  BatchOp,
  BatchResult,
  BatchWrite,
  DataPort,
  MergeSummary,
  UserProfile,
} from "@core/ports";

/**
 * Per-uid document store mirroring the ADR-004 Firestore model:
 *   users/{uid}                  -> profile
 *   users/{uid}/activities/{id}  -> activity
 *   users/{uid}/goals/{id}       -> goal
 *   users/{uid}/baseline         -> baseline (single doc)
 *   users/{uid}/streaks/current  -> streak (single doc)
 *   users/{uid}/counters/{name}  -> number (daily AI quota lives here)
 */
interface UserSpace {
  profile: UserProfile | null;
  activities: Map<string, Activity>;
  goals: Map<string, Goal>;
  baseline: Baseline | null;
  streak: Streak | null;
  counters: Map<string, number>;
}

function emptySpace(): UserSpace {
  return {
    profile: null,
    activities: new Map(),
    goals: new Map(),
    baseline: null,
    streak: null,
    counters: new Map(),
  };
}

function cloneActivity(activity: Activity): Activity {
  return structuredClone(activity);
}

/**
 * Credential-free in-memory DataPort. Implements the SAME explicit
 * atomic-batch / idempotent-merge contract as the GCP Firestore adapter so
 * the merge logic and the persisted AI quota are unit-testable locally
 * with zero GCP calls (ADR-002, ADR-004).
 */
export class InMemoryDataPort implements DataPort {
  private readonly users = new Map<string, UserSpace>();
  private readonly appliedBatchKeys = new Map<string, BatchResult>();
  private readonly appliedMergeKeys = new Map<string, MergeSummary>();

  private space(uid: string): UserSpace {
    let space = this.users.get(uid);
    if (!space) {
      space = emptySpace();
      this.users.set(uid, space);
    }
    return space;
  }

  async getProfile(uid: string): Promise<UserProfile | null> {
    const profile = this.users.get(uid)?.profile ?? null;
    return profile ? structuredClone(profile) : null;
  }

  async upsertProfile(profile: UserProfile): Promise<void> {
    this.space(profile.uid).profile = structuredClone(profile);
  }

  async addActivity(uid: string, activity: Activity): Promise<void> {
    this.space(uid).activities.set(activity.id, cloneActivity(activity));
  }

  async listActivities(
    uid: string,
    query?: ActivityQuery,
  ): Promise<Activity[]> {
    const all = [...(this.users.get(uid)?.activities.values() ?? [])];
    let filtered = all;
    if (query?.category !== undefined) {
      filtered = filtered.filter((a) => a.category === query.category);
    }
    if (query?.sinceTs !== undefined) {
      const since = query.sinceTs;
      filtered = filtered.filter((a) => a.ts >= since);
    }
    if (query?.untilTs !== undefined) {
      const until = query.untilTs;
      filtered = filtered.filter((a) => a.ts <= until);
    }
    filtered.sort((a, b) => b.ts - a.ts);
    if (query?.limit !== undefined) {
      filtered = filtered.slice(0, query.limit);
    }
    return filtered.map(cloneActivity);
  }

  async getBaseline(uid: string): Promise<Baseline | null> {
    const baseline = this.users.get(uid)?.baseline ?? null;
    return baseline ? structuredClone(baseline) : null;
  }

  async setBaseline(uid: string, baseline: Baseline): Promise<void> {
    this.space(uid).baseline = structuredClone(baseline);
  }

  async setGoal(uid: string, goal: Goal): Promise<void> {
    this.space(uid).goals.set(goal.id, structuredClone(goal));
  }

  async listGoals(uid: string): Promise<Goal[]> {
    return [...(this.users.get(uid)?.goals.values() ?? [])].map((g) =>
      structuredClone(g),
    );
  }

  async getStreak(uid: string): Promise<Streak | null> {
    const streak = this.users.get(uid)?.streak ?? null;
    return streak ? structuredClone(streak) : null;
  }

  async setStreak(uid: string, streak: Streak): Promise<void> {
    this.space(uid).streak = structuredClone(streak);
  }

  async getCounter(uid: string, name: string): Promise<number> {
    return this.users.get(uid)?.counters.get(name) ?? 0;
  }

  async incrementCounter(
    uid: string,
    name: string,
    by: number,
  ): Promise<number> {
    const space = this.space(uid);
    const next = (space.counters.get(name) ?? 0) + by;
    space.counters.set(name, next);
    return next;
  }

  /**
   * All-or-nothing batched write. Operations are first validated and staged
   * against deep clones of the touched documents; only if EVERY op succeeds is
   * the staged state committed. A mid-batch failure leaves the store untouched
   * (rollback). Replaying the same idempotencyKey returns the recorded result
   * without re-applying (idempotentReplay = true) — no double-write.
   */
  async runBatch(batch: BatchWrite): Promise<BatchResult> {
    const replay = this.appliedBatchKeys.get(batch.idempotencyKey);
    if (replay) {
      return { ...replay, idempotentReplay: true };
    }

    const space = this.space(batch.uid);
    const staged = this.stageOps(space, batch.ops);

    this.commitStaged(space, staged);

    const result: BatchResult = {
      applied: true,
      opsApplied: batch.ops.length,
      idempotentReplay: false,
    };
    this.appliedBatchKeys.set(batch.idempotencyKey, result);
    return result;
  }

  /**
   * Validate + stage every op against clones. Throwing here (before any commit)
   * is what makes the batch atomic: the caller's store is never half-written.
   */
  private stageOps(
    space: UserSpace,
    ops: readonly BatchOp[],
  ): Map<string, Map<string, unknown> | "delete-marker"> {
    const staged = new Map<string, Map<string, unknown> | "delete-marker">();

    for (const op of ops) {
      const collection = this.collectionMap(space, op.collection);
      if (!staged.has(op.collection)) {
        staged.set(op.collection, new Map(collection));
      }
      const view = staged.get(op.collection);
      if (!(view instanceof Map)) {
        throw new Error(
          `Batch op conflict on collection "${op.collection}": delete-marker not supported.`,
        );
      }
      switch (op.kind) {
        case "set": {
          view.set(op.id, structuredClone(op.data));
          break;
        }
        case "merge": {
          const existing = view.get(op.id);
          const base =
            existing && typeof existing === "object"
              ? (existing as Record<string, unknown>)
              : {};
          const incoming =
            op.data && typeof op.data === "object"
              ? (op.data as Record<string, unknown>)
              : {};
          view.set(op.id, structuredClone({ ...base, ...incoming }));
          break;
        }
        case "delete": {
          view.delete(op.id);
          break;
        }
        default: {
          const exhaustive: never = op;
          throw new Error(`Unknown batch op: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
    return staged;
  }

  private commitStaged(
    space: UserSpace,
    staged: Map<string, Map<string, unknown> | "delete-marker">,
  ): void {
    for (const [name, view] of staged) {
      if (!(view instanceof Map)) {
        continue;
      }
      const target = this.collectionMap(space, name);
      target.clear();
      for (const [id, data] of view) {
        target.set(id, data);
      }
    }
  }

  private collectionMap(
    space: UserSpace,
    collection: string,
  ): Map<string, unknown> {
    switch (collection) {
      case "activities":
        return space.activities as unknown as Map<string, unknown>;
      case "goals":
        return space.goals as unknown as Map<string, unknown>;
      case "counters":
        return space.counters as unknown as Map<string, unknown>;
      default:
        throw new Error(
          `Unknown batch collection "${collection}". Allowed: activities, goals, counters.`,
        );
    }
  }

  /**
   * Idempotent, atomic merge of a source uid's subcollections into a target
   * uid. Activities and goals are copied; the baseline is copied only if the
   * target has none. The merge is staged then committed in one shot, and the
   * idempotencyKey guard makes a re-run a no-op (no double-write) — this is the
   * locally-unit-testable shadow of the Firestore transaction.
   */
  async mergeUserData(
    sourceUid: string,
    targetUid: string,
    idempotencyKey: string,
  ): Promise<MergeSummary> {
    const replay = this.appliedMergeKeys.get(idempotencyKey);
    if (replay) {
      return { ...replay, idempotentReplay: true };
    }

    const source = this.users.get(sourceUid) ?? emptySpace();
    const target = this.space(targetUid);

    const stagedActivities = new Map(target.activities);
    const stagedGoals = new Map(target.goals);
    let copiedActivities = 0;
    let copiedGoals = 0;

    for (const [id, activity] of source.activities) {
      if (!stagedActivities.has(id)) {
        stagedActivities.set(id, cloneActivity(activity));
        copiedActivities += 1;
      }
    }
    for (const [id, goal] of source.goals) {
      if (!stagedGoals.has(id)) {
        stagedGoals.set(id, structuredClone(goal));
        copiedGoals += 1;
      }
    }

    let copiedBaseline = false;
    let stagedBaseline = target.baseline;
    if (target.baseline === null && source.baseline !== null) {
      stagedBaseline = structuredClone(source.baseline);
      copiedBaseline = true;
    }

    target.activities = stagedActivities;
    target.goals = stagedGoals;
    target.baseline = stagedBaseline;

    const summary: MergeSummary = {
      copiedActivities,
      copiedGoals,
      copiedBaseline,
      idempotentReplay: false,
    };
    this.appliedMergeKeys.set(idempotencyKey, summary);
    return summary;
  }
}
