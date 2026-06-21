import Link from "next/link";
import type { Category } from "@core/schemas";
import { Card } from "../../../_components/Card";
import { ArrowUpRight, ChartLine } from "../../../_components/icons";
import { CATEGORY_LABELS } from "../../../_components/charts/series";

/** "Where to focus next" tile: names the top-contributing category and links to Insights. */
export function TopRecommendation({
  topCategory,
}: {
  topCategory: Category | null;
}) {
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
