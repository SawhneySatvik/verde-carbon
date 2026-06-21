/** The empty state shown when the user has no activities for the coach to reason about. */

import Link from "next/link";
import { Card } from "../../../_components/Card";
import { ArrowUpRight, PlusLog, Sparkles } from "../../../_components/icons";

export function EmptyCoach() {
  return (
    <Card
      as="section"
      aria-labelledby="coach-empty-title"
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
          <Sparkles size={28} />
        </span>
        <h2
          id="coach-empty-title"
          className="mt-6 text-balance font-display text-h2 text-text"
        >
          Log an activity to coach on
        </h2>
        <p className="mt-3 text-pretty text-body text-text-secondary">
          Your coach reasons from your own footprint. Once you&rsquo;ve logged a
          few activities — or loaded the sample data — it can point you at the
          swap that cuts the most, with every figure computed, never guessed.
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
