/** Ranked reduction card: rank box, category, now/after `<dl>`, factor link, log-swap CTA. */

import Link from "next/link";
import { Badge } from "../../../_components/Badge";
import { Card } from "../../../_components/Card";
import {
  ArrowDown,
  ArrowUpRight,
  ChartLine,
  Gauge,
  Ripple,
  Target,
} from "../../../_components/icons";
import type { Insight } from "./types";

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

export function InsightCard({ insight }: { insight: Insight }) {
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
