"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import type { Activity, Category, Goal, Streak } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Button } from "../../_components/Button";
import { BreakdownTable } from "../../_components/BreakdownTable";
import { Card } from "../../_components/Card";
import { Badge } from "../../_components/Badge";
import { BrandMark } from "../../_components/BrandMark";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartLine,
  ChevronDown,
  ChevronRight,
  PlusLog,
  Ripple,
  Sparkles,
} from "../../_components/icons";
import { SAMPLE_ID_PREFIX } from "@/app/api/dev/seed/sampleTag";
import { TrendChart } from "../../_components/charts/TrendChart";
import { CategoryChart } from "../../_components/charts/CategoryChart";
import { CATEGORY_LABELS } from "../../_components/charts/series";
import {
  bucketTrendByLocaleDay,
  totalsByCategory,
  trendDeltaPct,
  sumKg,
} from "../../_components/charts/bucketing";
import { localeDayKey } from "@/server/http/day";
import { activitiesToPreview } from "./_components/activityBreakdown";
import { GoalProgress } from "./_components/GoalProgress";

/**
 * Dashboard.
 *
 * Soft Structuralism × Asymmetrical Bento: a masonry of varying tile sizes where
 * a DOMINANT hero footprint tile (raised, brand-washed, Space-Grotesk display
 * number / Geist-Mono tabular digits) anchors the grid, with lighter secondary
 * tiles (streak, goal ring, top recommendation) and full-width chart tiles. Every
 * tile is the Double-Bezel `Card` material; the hero is the only `elevation="raised"`
 * tile so the elevation hierarchy reads at a glance. Tiles reveal with a tasteful
 * `m`-driven stagger (transform/opacity only, reduced-motion safe via the shared
 * MotionProvider's `MotionConfig reducedMotion="user"`); content is visible by
 * default — the reveal only enhances.
 *
 * PRESERVED (non-negotiable): the charts' non-colour encoding + keyboard-reachable
 * data-table fallbacks + text summaries; the "show the math" provenance (reads each
 * activity's STORED `co2eKg`/`factorSet`); the locale-day trend bucketing; the
 * focus-on-ready / focus-on-error refs + `tabIndex={-1}` targets; aria-live; heading
 * order; ≥44px targets. None of this touches the a11y model.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      activities: Activity[];
      goal: Goal | null;
      streak: Streak | null;
    };

/**
 * The display surface must never crash on an exotic/aliased IANA zone (some
 * runtimes resolve, e.g., "Asia/Calcutta" which strict `localeDayKey` rejects).
 * Probe the resolved zone once and fall back to UTC if it isn't usable, so the
 * dashboard degrades to UTC bucketing rather than a dead screen.
 */
function resolveTimeZone(): string {
  let zone = "UTC";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
  try {
    localeDayKey(new Date(), zone);
    return zone;
  } catch {
    return "UTC";
  }
}

/**
 * Staggered bento tile reveal. Transform/opacity only; honoured by the provider's
 * `reducedMotion="user"`, so reduced-motion users get the final state instantly.
 * Content is visible by default — `animate` is the steady state, never gated.
 */
function RevealTile({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.48,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </m.div>
  );
}

export default function DashboardPage() {
  const { announce } = useAnnouncer();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [showMath, setShowMath] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const reactId = useId();
  const timeZone = resolveTimeZone();

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    announce("Loading your dashboard…");
    try {
      const [actRes, goalsRes] = await Promise.all([
        fetch("/api/activities", { headers: { accept: "application/json" } }),
        fetch("/api/goals", { headers: { accept: "application/json" } }),
      ]);
      if (!actRes.ok || !goalsRes.ok) {
        throw new Error("fetch failed");
      }
      const actData = (await actRes.json()) as { activities: Activity[] };
      const goalsData = (await goalsRes.json()) as {
        goals: Goal[];
        streak: Streak | null;
      };
      const goal =
        goalsData.goals.find((g) => g.active) ?? goalsData.goals[0] ?? null;
      announce("Dashboard ready.");
      setPhase({
        kind: "ready",
        activities: actData.activities,
        goal,
        streak: goalsData.streak ?? null,
      });
    } catch {
      announce("We couldn't load your dashboard. Try again.", "assertive");
      setPhase({ kind: "error" });
    }
  }, [announce]);

  // Demo affordance: seed/clear the user's OWN anon account with sample data whose
  // CO2e is computed by the same calculator real logging uses (never fabricated),
  // then reload so the populated dashboard renders. Announced for SR users.
  const loadSample = useCallback(async () => {
    setSampleBusy(true);
    announce("Loading sample data…");
    try {
      const res = await fetch("/api/dev/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        throw new Error("seed failed");
      }
      announce("Sample data loaded. Showing your populated dashboard.");
      await load();
    } catch {
      announce("We couldn't load the sample data. Try again.", "assertive");
    } finally {
      setSampleBusy(false);
    }
  }, [announce, load]);

  const clearSample = useCallback(async () => {
    setSampleBusy(true);
    announce("Clearing sample data…");
    try {
      const res = await fetch("/api/dev/seed", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("clear failed");
      }
      announce("Sample data cleared.");
      await load();
    } catch {
      announce("We couldn't clear the sample data. Try again.", "assertive");
    } finally {
      setSampleBusy(false);
    }
  }, [announce, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase.kind === "error") {
      errorRef.current?.focus();
    }
  }, [phase.kind]);

  return (
    <div className="mx-auto max-w-app px-4 py-12 md:px-6 md:py-16 lg:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand" eyebrow icon={<Ripple size={13} />}>
            Your footprint
          </Badge>
          <h1 className="mt-3 text-balance font-display text-h1 text-text">
            Dashboard
          </h1>
        </div>
      </header>

      {phase.kind === "loading" && <DashboardSkeleton />}

      {phase.kind === "error" && (
        <DashboardError errorRef={errorRef} onRetry={() => void load()} />
      )}

      {phase.kind === "ready" && phase.activities.length === 0 && (
        <EmptyDashboard
          streak={phase.streak}
          onLoadSample={() => void loadSample()}
          sampleBusy={sampleBusy}
        />
      )}

      {phase.kind === "ready" && phase.activities.length > 0 && (
        <ReadyDashboard
          activities={phase.activities}
          goal={phase.goal}
          streak={phase.streak}
          timeZone={timeZone}
          showMath={showMath}
          onToggleMath={() => setShowMath((v) => !v)}
          mathPanelId={`total-math-${reactId}`}
          hasSampleData={phase.activities.some((a) =>
            a.id.startsWith(SAMPLE_ID_PREFIX),
          )}
          onClearSample={() => void clearSample()}
          sampleBusy={sampleBusy}
        />
      )}
    </div>
  );
}

function ReadyDashboard({
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

function StreakDisplay({ streak }: { streak: Streak | null }) {
  const count = streak?.count ?? 0;
  return (
    <div className="mt-3">
      <p className="flex items-baseline gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-brand-subtle text-brand-fg"
        >
          <Ripple size={20} />
        </span>
        <span className="numeric font-display text-display text-brand-active">
          {count}
        </span>
        <span className="font-display text-h3 text-text-muted">
          day{count === 1 ? "" : "s"}
        </span>
      </p>
      <p className="mt-3 text-body-sm text-text-secondary">
        {count === 0
          ? "Log an activity today to start a streak."
          : `Consecutive days you've logged. Longest: ${streak?.longest ?? count} day${(streak?.longest ?? count) === 1 ? "" : "s"}.`}
      </p>
      <p className="mt-1 text-caption text-text-muted">
        A streak counts each calendar day you log in your local time zone; miss
        a day and it restarts — you&rsquo;ll always see why, it&rsquo;s never
        reset silently.
      </p>
    </div>
  );
}

function TopRecommendation({ topCategory }: { topCategory: Category | null }) {
  const label = topCategory ? CATEGORY_LABELS[topCategory] : null;
  return (
    <Card
      as="section"
      aria-labelledby="reco-title"
      pad="lg"
      className="h-full"
      innerClassName="flex h-full flex-col"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg"
        >
          <ChartLine size={18} />
        </span>
        <h2 id="reco-title" className="font-display text-h3 text-text">
          Where to focus next
        </h2>
      </div>
      <p className="mt-3 flex-1 text-body text-text-secondary">
        {label ? (
          <>
            <span className="font-medium text-text">{label}</span> is your
            biggest contributor right now. Insights breaks down the
            highest-impact ways to cut it — each tied to a sourced emission
            factor.
          </>
        ) : (
          <>
            Log a few activities and Verdé will point you at the highest-impact
            reductions — each tied to a sourced emission factor.
          </>
        )}
      </p>
      <div className="mt-5">
        <Link
          href="/insights"
          className="group inline-flex min-h-[44px] items-center gap-2 rounded-sm px-2 text-body-sm font-medium text-text-link transition-colors duration-fast ease-out-quart hover:text-text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        >
          Show me how to cut this
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-surface-sunken transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
          >
            <ArrowUpRight size={15} />
          </span>
        </Link>
      </div>
    </Card>
  );
}

function EmptyDashboard({
  streak,
  onLoadSample,
  sampleBusy,
}: {
  streak: Streak | null;
  onLoadSample: () => void;
  sampleBusy: boolean;
}) {
  return (
    <Card
      as="section"
      elevation="raised"
      accent="brand"
      pad="none"
      innerClassName="relative overflow-hidden px-6 py-14 text-center md:px-10 md:py-20"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 rounded-pill bg-surface-brand-subtle opacity-60 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-prose flex-col items-center">
        <span
          aria-hidden="true"
          className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
        >
          <BrandMark size={36} />
        </span>
        <h2 className="mt-6 text-balance font-display text-h2 text-text">
          Nothing logged yet
        </h2>
        <p className="mt-3 text-pretty text-body text-text-secondary">
          Your dashboard fills in as you log activities. Every number
          you&rsquo;ll see here is computed by our calculator from published
          emission factors — never invented. Log your first activity to see your
          trend, category breakdown, and goal progress.
        </p>
        {streak && streak.count > 0 && (
          <p className="mt-4">
            <Badge tone="brand" icon={<Ripple size={13} />}>
              Current streak: {streak.count} day{streak.count === 1 ? "" : "s"}
            </Badge>
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/log"
            className="group inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            <PlusLog size={18} aria-hidden="true" />
            Log your first activity
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
            >
              <ArrowUpRight size={15} />
            </span>
          </Link>
          <Button
            variant="secondary"
            onClick={onLoadSample}
            loading={sampleBusy}
            leadingIcon={<Sparkles size={18} />}
          >
            Load sample data
          </Button>
        </div>
        <p className="mt-4 text-caption text-text-muted">
          Sample data fills your own demo account with realistic activities —
          every number still computed by our calculator from published factors,
          never invented. Clear it any time.
        </p>
      </div>
    </Card>
  );
}

function DashboardError({
  errorRef,
  onRetry,
}: {
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  onRetry: () => void;
}) {
  return (
    <Card as="div" role="alert" accent="danger" innerClassName="p-8">
      <h2 className="inline-flex items-center gap-2 font-display text-h3 text-danger-fg">
        <AlertTriangle size={22} className="shrink-0" aria-hidden="true" />
        Couldn&rsquo;t load your dashboard
      </h2>
      <p
        ref={errorRef}
        tabIndex={-1}
        className="mt-2 max-w-prose text-body text-text focus:outline-none"
      >
        Something went wrong fetching your data. Your logs are safe — this is
        just the view.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[48px] items-center justify-center rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        >
          Retry
        </button>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      {/* Skeletons mirror the bento footprint; pulse is motion-safe only so
          reduced-motion users get a calm static placeholder. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <SkeletonTile className="lg:col-span-7 lg:row-span-2" height="h-72" />
        <SkeletonTile className="lg:col-span-5" height="h-44" />
        <SkeletonTile className="lg:col-span-5" height="h-44" />
        <SkeletonTile className="lg:col-span-12" height="h-56" />
        <SkeletonTile className="lg:col-span-12" height="h-72" />
        <SkeletonTile className="lg:col-span-12" height="h-72" />
      </div>
    </div>
  );
}

function SkeletonTile({
  className = "",
  height,
}: {
  className?: string;
  height: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring] ${className}`}
    >
      <div
        className={`${height} rounded-bezel-inner bg-surface-sunken motion-safe:animate-pulse`}
      />
    </div>
  );
}
