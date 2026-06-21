import type { Activity, Category } from "@core/schemas";
import { localeDayKey } from "@/server/http/day";

/**
 * Pure, I/O-free trend/category aggregation for the dashboard charts.
 *
 * A logged activity's `ts` is an absolute instant; which calendar DAY it
 * falls on depends on the user's time zone, NOT UTC. So bucketing reuses the
 * SAME `localeDayKey` semantics as the streak / AI-quota day boundary
 * (src/server/http/day.ts) — an activity logged at 23:30 local on the 1st and one
 * at 00:30 local on the 2nd land in DIFFERENT day buckets, and a DST "spring
 * forward" night still maps every instant to its correct local date. Tested at a
 * midnight and a DST boundary.
 */

export interface TrendBucket {
  /** `YYYY-MM-DD` local calendar date. */
  dayKey: string;
  totalKg: number;
  byCategory: Record<Category, number>;
}

export interface CategoryTotal {
  category: Category;
  totalKg: number;
}

const EMPTY_BY_CATEGORY: () => Record<Category, number> = () => ({
  transport: 0,
  energy: 0,
  diet: 0,
});

/**
 * Bucket activities into per-local-day totals, ascending by day. Empty days
 * between the first and last logged day are NOT synthesised here; the chart
 * plots the days that have data (an empty input yields an empty array, which the
 * dashboard renders as its empty state).
 */
export function bucketTrendByLocaleDay(
  activities: readonly Activity[],
  timeZone: string,
): TrendBucket[] {
  const buckets = new Map<string, TrendBucket>();
  for (const a of activities) {
    const dayKey = localeDayKey(new Date(a.ts), timeZone);
    let bucket = buckets.get(dayKey);
    if (!bucket) {
      bucket = { dayKey, totalKg: 0, byCategory: EMPTY_BY_CATEGORY() };
      buckets.set(dayKey, bucket);
    }
    bucket.totalKg += a.co2eKg;
    bucket.byCategory[a.category] += a.co2eKg;
  }
  return [...buckets.values()].sort((x, y) => x.dayKey.localeCompare(y.dayKey));
}

/** Total emissions per category, descending (the breakdown-bar order). */
export function totalsByCategory(
  activities: readonly Activity[],
): CategoryTotal[] {
  const totals = EMPTY_BY_CATEGORY();
  for (const a of activities) {
    totals[a.category] += a.co2eKg;
  }
  return (Object.keys(totals) as Category[])
    .map((category) => ({ category, totalKg: totals[category] }))
    .filter((t) => t.totalKg > 0)
    .sort((a, b) => b.totalKg - a.totalKg);
}

export function sumKg(activities: readonly Activity[]): number {
  return activities.reduce((sum, a) => sum + a.co2eKg, 0);
}

/**
 * Signed period-over-period delta as a percentage of the previous period.
 * Negative = emissions FELL (good). Returns null when there is no prior period to
 * compare against (so the UI can omit the delta rather than show a bogus 0%).
 */
export function trendDeltaPct(buckets: readonly TrendBucket[]): number | null {
  if (buckets.length < 2) {
    return null;
  }
  const previous = buckets[buckets.length - 2]!.totalKg;
  const current = buckets[buckets.length - 1]!.totalKg;
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}
