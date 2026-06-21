import { z } from "zod";
import type { Goal, Streak } from "@core/schemas";
import type { AuthPort, DataPort } from "@core/ports";
import {
  jsonResponse,
  localeDayKey,
  readJsonBody,
  requireIdentity,
  toErrorResponse,
} from "@/server/http";
import { createContainer } from "@/server/container";

/**
 * POST/GET /api/goals. Set/track a reduction goal and a logging streak,
 * persisted via the DataPort, both authz + Zod guarded.
 *
 * The streak day-boundary is the USER-LOCALE day from the SHARED `day.ts`
 * helper (the same one the AI-quota day uses), so the quota-reset day and the
 * streak day agree by construction. The rule is applied — not silently reset — on
 * a missed day: a gap of exactly one locale-day continues the streak, a larger
 * gap restarts it at 1, and a repeat on the same locale-day is a no-op.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const setGoalSchema = z
  .object({
    id: z.string().min(1).max(120),
    type: z.literal("reduction"),
    targetPct: z.number().finite().positive().max(100),
    baselineKg: z.number().finite().nonnegative(),
    period: z.enum(["weekly", "monthly", "yearly"]),
    active: z.boolean().optional(),
  })
  .strict();
export type SetGoalInput = z.infer<typeof setGoalSchema>;

export const trackStreakSchema = z
  .object({
    track: z.literal("streak"),
    timeZone: z.string().min(1).max(64).optional(),
  })
  .strict();

export const goalPostSchema = z.union([setGoalSchema, trackStreakSchema]);

export interface GoalsDeps {
  auth: AuthPort;
  data: DataPort;
  now?: () => Date;
}

async function resolveDeps(): Promise<GoalsDeps> {
  const { auth, data } = await createContainer();
  return { auth, data };
}

/**
 * Pure streak transition over user-locale day keys. `previous` is the persisted
 * streak (or null on first log). `todayKey` is `localeDayKey(now, tz)`. Returns
 * the next streak and a `transition` tag so the UI can SHOW a reset rather than
 * the count silently changing.
 */
export type StreakTransition =
  | "started"
  | "same-day"
  | "continued"
  | "missed-reset";

export interface StreakUpdate {
  streak: Streak;
  transition: StreakTransition;
}

function dayKeyToUtcMs(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00Z`);
}

/** Whole-day difference between two `YYYY-MM-DD` keys (DST-safe: keys are dates). */
export function dayGap(fromKey: string, toKey: string): number {
  const ms = dayKeyToUtcMs(toKey) - dayKeyToUtcMs(fromKey);
  return Math.round(ms / 86_400_000);
}

export function applyStreak(
  previous: Streak | null,
  todayKey: string,
): StreakUpdate {
  if (!previous) {
    return {
      streak: { count: 1, lastLoggedDate: todayKey, longest: 1 },
      transition: "started",
    };
  }

  const gap = dayGap(previous.lastLoggedDate, todayKey);
  if (gap <= 0) {
    return { streak: previous, transition: "same-day" };
  }
  if (gap === 1) {
    const count = previous.count + 1;
    return {
      streak: {
        count,
        lastLoggedDate: todayKey,
        longest: Math.max(previous.longest, count),
      },
      transition: "continued",
    };
  }
  // gap > 1: a day was missed — apply the rule, restart at 1, preserve longest.
  return {
    streak: {
      count: 1,
      lastLoggedDate: todayKey,
      longest: Math.max(previous.longest, 1),
    },
    transition: "missed-reset",
  };
}

async function handleSetGoal(
  input: SetGoalInput,
  deps: GoalsDeps,
  uid: string,
): Promise<Response> {
  const now = (deps.now ?? (() => new Date()))();
  const goal: Goal = {
    id: input.id,
    type: input.type,
    targetPct: input.targetPct,
    baselineKg: input.baselineKg,
    period: input.period,
    createdAt: now.getTime(),
    active: input.active ?? true,
  };
  await deps.data.setGoal(uid, goal);
  return jsonResponse(201, { goal });
}

async function handleTrackStreak(
  timeZone: string | undefined,
  deps: GoalsDeps,
  uid: string,
): Promise<Response> {
  const now = (deps.now ?? (() => new Date()))();
  const todayKey = localeDayKey(now, timeZone ?? "UTC");
  const previous = await deps.data.getStreak(uid);
  const { streak, transition } = applyStreak(previous, todayKey);
  if (transition !== "same-day") {
    await deps.data.setStreak(uid, streak);
  }
  return jsonResponse(200, { streak, transition });
}

export async function handlePost(
  req: Request,
  deps: GoalsDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const body = await readJsonBody(req, goalPostSchema);
    if ("track" in body) {
      return await handleTrackStreak(body.timeZone, deps, identity.uid);
    }
    return await handleSetGoal(body, deps, identity.uid);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function handleGet(
  req: Request,
  deps: GoalsDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const [goals, streak] = await Promise.all([
      deps.data.listGoals(identity.uid),
      deps.data.getStreak(identity.uid),
    ]);
    return jsonResponse(200, { goals, streak });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  return handlePost(req, await resolveDeps());
}

export async function GET(req: Request): Promise<Response> {
  return handleGet(req, await resolveDeps());
}
