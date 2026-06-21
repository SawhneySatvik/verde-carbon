"use client";

import Link from "next/link";
import { previewActivities } from "@core/calculator/preview";
import type { Locale } from "@core/schemas";
import { BreakdownTable } from "../../../_components/BreakdownTable";
import { Card } from "../../../_components/Card";
import { AlertTriangle, ArrowUpRight } from "../../../_components/icons";
import type { WizardItemInput } from "./types";

/** Primary CTA — a real <a> (anchor) so it keeps the link role e2e relies on,
 *  styled to the primary Button material incl. the trailing "island" icon. */
const ctaClass =
  "group inline-flex min-h-[48px] select-none items-center justify-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium leading-none text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]";

function CtaIsland() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
    >
      <ArrowUpRight size={18} />
    </span>
  );
}

/**
 * Wizard step 4 — Review (baseline).
 *
 * Renders the baseline as a real breakdown table: per item qty/unit/factor/
 * source/CO2e, all computed by the CLIENT-IMPORTABLE preview module
 * (previewActivities) — never invented. A missing-factor notice is shown when an
 * input could not be sourced (it is excluded from the total). "See my dashboard"
 * completes onboarding.
 */
export function StepReview({
  items,
  locale,
}: {
  items: readonly WizardItemInput[];
  locale: Locale;
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="font-display text-h2 text-balance text-text">
          Review your baseline
        </h2>
        <Card pad="md" innerClassName="bg-surface-sunken">
          <p className="text-body text-text-secondary">
            You haven&rsquo;t entered any figures yet. Go back and fill in at
            least one activity, or head to your dashboard and log activities as
            you go.
          </p>
        </Card>
        <Link href="/dashboard" className={ctaClass}>
          See my dashboard
          <CtaIsland />
        </Link>
      </div>
    );
  }

  const result = previewActivities(items, { locale });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 text-balance text-text">
          Review your baseline
        </h2>
        <p className="mt-2 max-w-[60ch] text-body text-text-secondary">
          Here&rsquo;s your estimated monthly footprint, computed from published
          factors. Every number links to its source — nothing here was invented.
        </p>
      </div>

      <BreakdownTable
        result={result}
        caption="Your baseline footprint by activity"
      />

      {result.hasUnsourced && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-bg p-4"
        >
          <AlertTriangle
            size={18}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-warning-fg"
          />
          <p className="text-body-sm text-warning-fg">
            {result.unsourcedCount} item
            {result.unsourcedCount === 1 ? "" : "s"} couldn&rsquo;t be sourced
            and {result.unsourcedCount === 1 ? "was" : "were"} left out of your
            total. We never guess a number we can&rsquo;t back with a published
            factor.
          </p>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="numeric text-body-sm text-text-muted" aria-hidden="true">
          {result.sourcedCount} sourced · {result.totalKgDisplay.toFixed(2)} kg
          CO₂e / month
        </p>
        <Link href="/dashboard" className={`${ctaClass} w-full sm:w-auto`}>
          See my dashboard
          <CtaIsland />
        </Link>
      </div>
    </div>
  );
}
