"use client";

import Link from "next/link";
import type { Activity, Goal, Streak } from "@core/schemas";
import { Button } from "../../../_components/Button";
import { BreakdownTable } from "../../../_components/BreakdownTable";
import { Card } from "../../../_components/Card";
import { BrandMark } from "../../../_components/BrandMark";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartLine,
  ChevronDown,
  ChevronRight,
  PlusLog,
  Sparkles,
} from "../../../_components/icons";
import { TrendChart } from "../../../_components/charts/TrendChart";
import { CategoryChart } from "../../../_components/charts/CategoryChart";
import {
  bucketTrendByLocaleDay,
  totalsByCategory,
  trendDeltaPct,
  sumKg,
} from "../../../_components/charts/bucketing";
import { activitiesToPreview } from "./activityBreakdown";
import { GoalProgress } from "./GoalProgress";
import { RevealTile } from "./RevealTile";
import { StreakDisplay } from "./StreakDisplay";
import { TopRecommendation } from "./TopRecommendation";

/** The composed "ready" bento view: hero total, streak, recommendation, goal, charts, and actions. */
export function ReadyDashboard({
  activities,
  goal,
  streak,
  timeZone,
  showMath,
  onToggleMath,
  mathPanelId,
  hasSampleData,
  onClearSample,
  sampleBusy,
}: {
  activities: Activity[];
  goal: Goal | null;
  streak: Streak | null;
  timeZone: string;
  showMath: boolean;
  onToggleMath: () => void;
  mathPanelId: string;
  hasSampleData: boolean;
  onClearSample: () => void;
  sampleBusy: boolean;
}) {
  const totalKg = sumKg(activities);
  const buckets = bucketTrendByLocaleDay(activities, timeZone);
  const categories = totalsByCategory(activities);
  const deltaPct = trendDeltaPct(buckets);
  const preview = activitiesToPreview(activities);
  const targetKg = goal
    ? goal.baselineKg * (1 - goal.targetPct / 100)
    : undefined;

  const topCategory = categories[0]?.category ?? null;

  const improved = deltaPct !== null && deltaPct < 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* ── HERO footprint tile — the dominant, raised, brand-washed anchor ── */}
      <RevealTile index={0} className="lg:col-span-7 lg:row-span-2">
        <Card
          as="section"
          aria-labelledby="total-title"
          elevation="raised"
          accent="brand"
          pad="none"
          className="h-full"
          innerClassName="relative h-full overflow-hidden p-6 md:p-10"
        >
          {/* soft brand wash, low-opacity, decorative (green ≤ 15% of surface) */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-pill bg-surface-brand-subtle opacity-70 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-6 top-6 text-brand-fg/40"
          >
            <BrandMark size={40} />
          </span>

          <div className="relative">
            <h2 id="total-title" className="text-h4 text-text-secondary">
              Total footprint logged
            </h2>

            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="numeric font-display text-display text-brand-active">
                {totalKg.toFixed(2)}
              </span>
              <span className="font-display text-h3 text-text-muted">
                kg&nbsp;CO₂e
              </span>
            </p>

            {deltaPct !== null && (
              <p
                className={`mt-3 inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-body-sm font-medium ${
                  improved
                    ? "bg-success-bg text-success-fg"
                    : "bg-danger-bg text-danger-fg"
                }`}
              >
                {improved ? (
                  <ArrowDown
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowUp size={16} className="shrink-0" aria-hidden="true" />
                )}
                <span className="numeric">
                  {deltaPct > 0 ? "+" : ""}
                  {deltaPct.toFixed(0)}%
                </span>
                <span>
                  {improved
                    ? "lower than the previous day"
                    : "higher than the previous day"}
                </span>
              </p>
            )}

            <div className="mt-7 border-t border-border pt-5">
              <button
                type="button"
                aria-expanded={showMath}
                aria-controls={mathPanelId}
                onClick={onToggleMath}
                className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-2 py-1 text-body-sm font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                {showMath ? (
                  <ChevronDown
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronRight
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                )}
                Show the math
                <span className="sr-only"> for your total footprint</span>
              </button>
              {showMath && (
                <div id={mathPanelId} className="mt-3">
                  <BreakdownTable
                    result={preview}
                    caption="How your total footprint is computed: every logged activity, its factor, source, and CO₂e."
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      </RevealTile>

      {/* ── Streak (secondary tile, resting elevation) ── */}
      <RevealTile index={1} className="lg:col-span-5">
        <Card
          as="section"
          aria-labelledby="streak-title"
          pad="lg"
          className="h-full"
          innerClassName="flex h-full flex-col justify-center"
        >
          <h2 id="streak-title" className="text-h4 text-text-secondary">
            Logging streak
          </h2>
          <StreakDisplay streak={streak} />
        </Card>
      </RevealTile>

      {/* ── Top recommendation (secondary tile) ── */}
      <RevealTile index={2} className="lg:col-span-5">
        <TopRecommendation topCategory={topCategory} />
      </RevealTile>

      {/* ── Goal progress (full width) ── */}
      <RevealTile index={3} className="lg:col-span-12">
        <Card as="section" aria-labelledby="goal-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="goal-title" className="font-display text-h3 text-text">
              Goal progress
            </h2>
            <Link
              href="/goal"
              className="inline-flex min-h-[44px] items-center rounded-sm px-1 text-body-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
            >
              {goal ? "Edit goal" : "Set a goal"}
            </Link>
          </div>
          {goal ? (
            <GoalProgress goal={goal} currentKg={totalKg} />
          ) : (
            <p className="text-body text-text-secondary">
              No goal yet.{" "}
              <Link
                href="/goal"
                className="rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                Set a reduction target
              </Link>{" "}
              to track your progress.
            </p>
          )}
        </Card>
      </RevealTile>

      {/* ── Trend chart (full width) ── */}
      <RevealTile index={4} className="lg:col-span-12">
        <Card as="section" aria-labelledby="trend-title">
          <h2 id="trend-title" className="mb-1 font-display text-h3 text-text">
            Footprint over time
          </h2>
          <p className="mb-4 text-body-sm text-text-muted">
            One point per logged day, in your local time zone.
          </p>
          <TrendChart
            buckets={buckets}
            targetKg={targetKg}
            titleId="trend-title"
          />
        </Card>
      </RevealTile>

      {/* ── Category chart (full width) ── */}
      <RevealTile index={5} className="lg:col-span-12">
        <Card as="section" aria-labelledby="category-title">
          <h2
            id="category-title"
            className="mb-4 font-display text-h3 text-text"
          >
            Where it comes from
          </h2>
          <CategoryChart totals={categories} titleId="category-title" />
        </Card>
      </RevealTile>

      {/* ── Drill-down entry points ── */}
      <RevealTile index={6} className="lg:col-span-12">
        <nav aria-label="Dashboard actions">
          <ul className="flex flex-wrap gap-3">
            <li>
              <Link
                href="/log"
                className="group inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                <PlusLog size={18} aria-hidden="true" />
                Log an activity
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                >
                  <ArrowUpRight size={15} />
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/insights"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm border border-border-interactive bg-surface px-6 py-3 text-body font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                <ChartLine size={18} aria-hidden="true" />
                Show me how to cut this
              </Link>
            </li>
          </ul>
          {hasSampleData && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-body-sm text-text-muted">
              <Sparkles size={15} aria-hidden="true" className="shrink-0" />
              <span>Viewing demo sample data.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSample}
                loading={sampleBusy}
              >
                Clear sample data
              </Button>
            </p>
          )}
        </nav>
      </RevealTile>
    </div>
  );
}
