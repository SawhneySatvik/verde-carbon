"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Button } from "../../_components/Button";
import { Card } from "../../_components/Card";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpRight,
  ChartLine,
  Gauge,
  PlusLog,
  Ripple,
  Target,
} from "../../_components/icons";

/**
 * Insights — ranked reduction list.
 *
 * Soft Structuralism: each ranked reduction is its own resting Double-Bezel
 * `Card`, opening with a big Space-Grotesk numbered rank index, a category icon,
 * the calculator-sourced projected saving in tabular Geist-Mono inside a success
 * `Badge`, the phrased action, a now→after comparison, the factor-source link,
 * and a CTA to log it. Tiles reveal with a tasteful `m`-driven stagger
 * (transform/opacity only, reduced-motion safe via the shared MotionProvider's
 * `MotionConfig reducedMotion="user"`); content is visible by default.
 *
 * PRESERVED (non-negotiable): every quantified saving comes from
 * `GET /api/insights`, derived from the PURE calculator (ADR-001) — the model
 * only phrases. The list is a real semantic <ol> and the RANK is stated IN TEXT
 * ("#1 highest impact"), never by position/colour alone. Empty /
 * loading / error states all render; loading/error refs + aria-live preserved.
 */

interface FactorBasis {
  candidateFactorKey: string;
  factorValue: number;
  factorSet: "EPA" | "DEFRA_DESNZ";
  factorSetVersion: string;
  source: { name: string; url: string; edition: string; publishedYear: number };
  co2eKg: number;
}

interface Insight {
  id: string;
  title: string;
  rank: number;
  projectedKgSaved: number;
  projectedKgSavedDisplay: number;
  currentBasis: FactorBasis;
  alternativeBasis: FactorBasis;
  phrase: string;
}

interface SkippedCandidate {
  id: string;
  title: string;
  reason: string;
  detail: string;
}

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; insights: Insight[]; skipped: SkippedCandidate[] };

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Category, derived from the calculator's own factor key (e.g. "diet.meal.beef"
 * → diet). This is the same sourced data the saving comes from — never invented.
 * The icon is paired with the visible category LABEL, so the channel is never
 * icon-only.
 */
type InsightCategory = "transport" | "energy" | "diet" | "other";

const CATEGORY_META: Record<
  InsightCategory,
  { label: string; Icon: typeof Gauge }
> = {
  transport: { label: "Transport", Icon: Gauge },
  energy: { label: "Home energy", Icon: Ripple },
  diet: { label: "Food & diet", Icon: Target },
  other: { label: "Reduction", Icon: ChartLine },
};

function categoryFor(insight: Insight): InsightCategory {
  const prefix = insight.currentBasis.candidateFactorKey.split(".")[0];
  if (prefix === "transport" || prefix === "energy" || prefix === "diet") {
    return prefix;
  }
  return "other";
}

export default function InsightsPage() {
  const { announce } = useAnnouncer();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    announce("Loading your insights…");
    try {
      const res = await fetch("/api/insights", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error("fetch failed");
      }
      const data = (await res.json()) as {
        insights: Insight[];
        skipped: SkippedCandidate[];
      };
      announce(
        data.insights.length === 0
          ? "No personalised insights yet."
          : `${data.insights.length} ranked insight${data.insights.length === 1 ? "" : "s"} ready.`,
      );
      setPhase({
        kind: "ready",
        insights: data.insights,
        skipped: data.skipped ?? [],
      });
    } catch {
      announce("We couldn't load your insights. Try again.", "assertive");
      setPhase({ kind: "error" });
    }
  }, [announce]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase.kind === "error") {
      errorRef.current?.focus();
    }
  }, [phase.kind]);

  return (
    <div className="mx-auto max-w-prose px-4 py-12 md:px-6 md:py-16">
      <header className="mb-10">
        <Badge tone="brand" eyebrow icon={<ChartLine size={13} />}>
          Reduce your footprint
        </Badge>
        <h1 className="mt-3 text-balance font-display text-h1 text-text">
          Ranked insights
        </h1>
        <p className="mt-3 max-w-[58ch] text-pretty text-body-lg text-text-secondary">
          Derived from your own logged activities. Every projected saving is
          computed by our calculator from published factors — the wording is the
          only thing AI touches.
        </p>
      </header>

      {phase.kind === "loading" && <InsightsSkeleton />}

      {phase.kind === "error" && (
        <InsightsError errorRef={errorRef} onRetry={() => void load()} />
      )}

      {phase.kind === "ready" && phase.insights.length === 0 && (
        <EmptyInsights />
      )}

      {phase.kind === "ready" && phase.insights.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-text-muted" role="status">
              {phase.insights.length} insight
              {phase.insights.length === 1 ? "" : "s"}, ranked by impact.
            </p>
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          <ol className="space-y-5">
            {phase.insights.map((insight, i) => (
              <m.li
                key={insight.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.44, delay: 0.06 * i, ease }}
              >
                <InsightCard insight={insight} />
              </m.li>
            ))}
          </ol>

          {phase.skipped.length > 0 && (
            <section aria-labelledby="skipped-title" className="mt-10">
              <h2
                id="skipped-title"
                className="font-display text-h4 text-text-secondary"
              >
                Not ranked
              </h2>
              <p className="mt-2 max-w-[58ch] text-body-sm text-text-muted">
                We couldn&rsquo;t source a saving for these, so they were left
                out rather than shown with a guessed number.
              </p>
              <ul className="mt-3 space-y-1.5">
                {phase.skipped.map((s) => (
                  <li
                    key={s.id}
                    className="text-body-sm text-text-secondary before:mr-2 before:text-text-muted before:content-['—']"
                  >
                    <span className="font-medium text-text">{s.title}</span>{" "}
                    {s.detail}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const rankLabel = `#${insight.rank} highest impact`;
  const category = categoryFor(insight);
  const { label: categoryLabel, Icon } = CATEGORY_META[category];
  const isTop = insight.rank === 1;

  return (
    <Card
      as="div"
      elevation={isTop ? "raised" : "rest"}
      accent={isTop ? "brand" : "none"}
      pad="lg"
      innerClassName="flex flex-col gap-5"
    >
      {/* Header row — rank index (Space-Grotesk, IN TEXT), category, saving badge */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Numbered rank index — stated in text, not by position/colour alone */}
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle">
            <span
              aria-hidden="true"
              className="numeric font-display text-h3 font-bold leading-none text-brand-fg"
            >
              {insight.rank}
            </span>
          </span>
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
              {rankLabel}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-body-sm font-medium text-text-secondary">
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              {categoryLabel}
            </p>
          </div>
        </div>

        {/* Calculator-sourced projected saving — tabular mono inside a Badge */}
        <Badge
          tone="success"
          icon={<ArrowDown size={14} className="shrink-0" />}
        >
          <span className="numeric font-medium">
            −{insight.projectedKgSavedDisplay.toFixed(2)} kg CO₂e
          </span>
        </Badge>
      </div>

      <div>
        <h3 className="text-balance text-h3 text-text">{insight.title}</h3>
        <p className="mt-2 text-pretty text-body text-text-secondary">
          {insight.phrase}
        </p>
      </div>

      {/* Now → after comparison, tabular mono on a recessed well */}
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-md bg-border text-body-sm sm:grid-cols-2">
        <div className="bg-surface-sunken px-4 py-3">
          <dt className="text-caption text-text-muted">Now</dt>
          <dd className="numeric mt-0.5 text-body font-medium text-text">
            {insight.currentBasis.co2eKg.toFixed(2)} kg CO₂e
          </dd>
        </div>
        <div className="bg-surface-sunken px-4 py-3">
          <dt className="text-caption text-text-muted">After the swap</dt>
          <dd className="numeric mt-0.5 text-body font-medium text-brand-active">
            {insight.alternativeBasis.co2eKg.toFixed(2)} kg CO₂e
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-caption text-text-muted">
          Based on your logs · factor basis:{" "}
          <a
            href={insight.currentBasis.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            {insight.currentBasis.source.name} —{" "}
            {insight.currentBasis.candidateFactorKey}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>

        <Link
          href="/log"
          className="group inline-flex min-h-[44px] items-center gap-2 rounded-sm px-2 text-body-sm font-medium text-text-link transition-colors duration-fast ease-out-quart hover:text-text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        >
          Log this swap
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

function EmptyInsights() {
  return (
    <Card
      as="section"
      aria-labelledby="insights-empty-title"
      elevation="raised"
      accent="brand"
      pad="none"
      innerClassName="relative overflow-hidden px-6 py-14 text-center md:px-10 md:py-16"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 rounded-pill bg-surface-brand-subtle opacity-60 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-[46ch] flex-col items-center">
        <span
          aria-hidden="true"
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
        >
          <ChartLine size={28} />
        </span>
        <h2
          id="insights-empty-title"
          className="mt-6 text-balance font-display text-h2 text-text"
        >
          Log a few more activities
        </h2>
        <p className="mt-3 text-pretty text-body text-text-secondary">
          There isn&rsquo;t enough of your own data yet to personalise
          reductions. Once you&rsquo;ve logged a few activities we can rank the
          swaps that cut the most — with the saving computed, not guessed.
        </p>
        <div className="mt-8">
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
        </div>
      </div>
    </Card>
  );
}

function InsightsError({
  errorRef,
  onRetry,
}: {
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  onRetry: () => void;
}) {
  return (
    <Card as="div" role="alert" accent="danger" pad="lg">
      <h2 className="inline-flex items-center gap-2 font-display text-h3 text-danger-fg">
        <AlertTriangle size={22} className="shrink-0" aria-hidden="true" />
        Couldn&rsquo;t load insights
      </h2>
      <p
        ref={errorRef}
        tabIndex={-1}
        className="mt-2 max-w-prose text-body text-text focus:outline-none"
      >
        Something went wrong. Your data is safe.
      </p>
      <div className="mt-5">
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </Card>
  );
}

function InsightsSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading insights…</span>
      {/* Skeletons mirror the ranked cards; pulse is motion-safe only so
          reduced-motion users get a calm static placeholder. */}
      <ul className="space-y-5">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            aria-hidden="true"
            className="rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring]"
          >
            <div className="h-40 rounded-bezel-inner bg-surface-sunken motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
