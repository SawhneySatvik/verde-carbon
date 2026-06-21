/** Empty state — too little logged data to personalise; offers a first-log CTA. */

import Link from "next/link";
import { Card } from "../../../_components/Card";
import { ArrowUpRight, ChartLine, PlusLog } from "../../../_components/icons";

export function EmptyInsights() {
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
