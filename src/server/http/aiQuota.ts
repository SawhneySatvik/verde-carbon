import type { DataPort } from "@core/ports";
import { localeDayKey } from "./day";
import { errors } from "./errors";

/**
 * Persisted per-anon-uid DAILY AI-call quota (the correctness floor). Backed
 * by the DataPort counter doc (`users/{uid}/counters/{name}`), so it SURVIVES
 * across Cloud Run instances — the in-memory limiter (rateLimit.ts) is only the
 * fast path and can be bypassed by hitting different instances; this cannot.
 * Prevents multi-instance bypass and AI cost runaway.
 *
 * The counter name embeds the USER-LOCALE day key from the shared `day.ts`
 * helper, so the daily rollover happens at the SAME boundary the streak
 * logic uses — quota-reset day and streak day agree by construction.
 */

export const DEFAULT_DAILY_AI_QUOTA = 50;
const COUNTER_PREFIX = "ai";

export interface AiQuotaOptions {
  /** Max AI calls per user per locale-day. */
  dailyLimit?: number;
  /** IANA time zone defining the day boundary (must match the streak rule). */
  timeZone?: string;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  dayKey: string;
}

export function aiQuotaCounterName(dayKey: string): string {
  return `${COUNTER_PREFIX}:${dayKey}`;
}

/**
 * Reserve one AI call against the persisted daily quota and return the status.
 * Increments the persisted counter FIRST (read-modify-write via the DataPort's
 * atomic increment) then checks the new total against the limit — so two
 * concurrent instances cannot both slip through on the boundary. When the limit
 * is already reached the call is denied and the caller routes to the structured
 * fallback (never a hard failure of the whole request).
 */
export async function reserveAiCall(
  data: DataPort,
  uid: string,
  options: AiQuotaOptions = {},
): Promise<QuotaStatus> {
  const limit = options.dailyLimit ?? DEFAULT_DAILY_AI_QUOTA;
  const timeZone = options.timeZone ?? "UTC";
  const now = options.now ?? (() => new Date());

  const dayKey = localeDayKey(now(), timeZone);
  const counter = aiQuotaCounterName(dayKey);

  const used = await data.incrementCounter(uid, counter, 1);
  if (used > limit) {
    return {
      allowed: false,
      used: used - 1,
      limit,
      remaining: 0,
      dayKey,
    };
  }
  return {
    allowed: true,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    dayKey,
  };
}

/** Read-only current usage for `uid` on the active locale-day (no reservation). */
export async function peekAiQuota(
  data: DataPort,
  uid: string,
  options: AiQuotaOptions = {},
): Promise<QuotaStatus> {
  const limit = options.dailyLimit ?? DEFAULT_DAILY_AI_QUOTA;
  const timeZone = options.timeZone ?? "UTC";
  const now = options.now ?? (() => new Date());

  const dayKey = localeDayKey(now(), timeZone);
  const used = await data.getCounter(uid, aiQuotaCounterName(dayKey));
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    dayKey,
  };
}

/**
 * Compose-friendly guard: reserve an AI call and throw a 429 `quota_exceeded`
 * when the daily limit is exhausted. Handlers that prefer a soft fallback use
 * {@link reserveAiCall} directly and branch on `allowed`.
 */
export async function enforceAiQuota(
  data: DataPort,
  uid: string,
  options: AiQuotaOptions = {},
): Promise<QuotaStatus> {
  const status = await reserveAiCall(data, uid, options);
  if (!status.allowed) {
    throw errors.quotaExceeded();
  }
  return status;
}
