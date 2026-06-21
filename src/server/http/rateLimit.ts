import { errors } from "./errors";

/**
 * In-memory token-bucket limiter — the FAST PATH for per-request throttling
 * keyed by uid (or IP for unauthenticated callers). It is per-instance and is
 * NOT the multi-instance correctness floor; the persisted per-anon-uid daily
 * quota (aiQuota.ts) is. Used together: this absorbs bursts cheaply, the quota
 * survives across Cloud Run instances and prevents cost runaway.
 */

export interface TokenBucketOptions {
  /** Max tokens the bucket can hold (burst size). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

/**
 * Shared fast-path limiter config for the AI routes (parse, parse-image, coach,
 * insights): a burst of 20 then ~1/sec sustained, per uid. The persisted daily
 * quota (aiQuota.ts) remains the multi-instance correctness floor.
 */
export const AI_RATE_LIMIT: TokenBucketOptions = {
  capacity: 20,
  refillPerSecond: 1,
};

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, BucketState>();

  constructor(options: TokenBucketOptions) {
    if (options.capacity <= 0 || options.refillPerSecond <= 0) {
      throw new Error(
        "Token-bucket capacity and refill rate must be positive.",
      );
    }
    this.capacity = options.capacity;
    this.refillPerSecond = options.refillPerSecond;
    this.now = options.now ?? Date.now;
  }

  private refill(state: BucketState, nowMs: number): void {
    const elapsedSec = (nowMs - state.lastRefillMs) / 1000;
    if (elapsedSec <= 0) {
      return;
    }
    state.tokens = Math.min(
      this.capacity,
      state.tokens + elapsedSec * this.refillPerSecond,
    );
    state.lastRefillMs = nowMs;
  }

  /** Try to consume one token for `key`. Pure decision — no throw. */
  consume(key: string, cost = 1): RateLimitDecision {
    const nowMs = this.now();
    let state = this.buckets.get(key);
    if (!state) {
      state = { tokens: this.capacity, lastRefillMs: nowMs };
      this.buckets.set(key, state);
    } else {
      this.refill(state, nowMs);
    }

    if (state.tokens >= cost) {
      state.tokens -= cost;
      return {
        allowed: true,
        remaining: Math.floor(state.tokens),
        retryAfterSeconds: 0,
      };
    }

    const deficit = cost - state.tokens;
    return {
      allowed: false,
      remaining: Math.floor(state.tokens),
      retryAfterSeconds: Math.ceil(deficit / this.refillPerSecond),
    };
  }

  /** Test/maintenance helper: drop a key's bucket. */
  reset(key: string): void {
    this.buckets.delete(key);
  }
}

/**
 * Pick the limiter key: the verified uid when present, else the client IP from
 * the standard proxy headers (Cloud Run sets `x-forwarded-for`). Unknown
 * callers share an `anon-ip` bucket rather than being unlimited.
 */
export function rateLimitKey(
  req: Request,
  uid: string | null | undefined,
): string {
  if (uid) {
    return `uid:${uid}`;
  }
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip ? `ip:${ip}` : "ip:unknown";
}

/** Compose-friendly guard: throw a 429 (with retry hint) when over the limit. */
export function enforceRateLimit(
  limiter: TokenBucketRateLimiter,
  key: string,
): RateLimitDecision {
  const decision = limiter.consume(key);
  if (!decision.allowed) {
    throw errors.rateLimited(decision.retryAfterSeconds);
  }
  return decision;
}
