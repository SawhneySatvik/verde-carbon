/** The "Grounded in your data" complementary panel — calculator-sourced figures, never AI. */

import Link from "next/link";
import type { Category } from "@core/schemas";
import { Card } from "../../../_components/Card";
import { ChartLine, Gauge, Ripple, Target } from "../../../_components/icons";
import type { CoachGrounding } from "./types";

/** Category → visible label + icon, mirroring the Insights screen vocabulary. */
const CATEGORY_META: Record<Category, { label: string; Icon: typeof Gauge }> = {
  transport: { label: "Transport", Icon: Gauge },
  energy: { label: "Home energy", Icon: Ripple },
  diet: { label: "Food & diet", Icon: Target },
};

export function GroundingPanel({
  headingId,
  grounding,
}: {
  headingId: string;
  grounding: CoachGrounding | null;
}) {
  const hasData = (grounding?.activityCount ?? 0) > 0;
  const category =
    grounding?.topCategory !== null && grounding?.topCategory !== undefined
      ? CATEGORY_META[grounding.topCategory]
      : null;

  return (
    <Card as="div" accent="brand" pad="lg" innerClassName="flex flex-col gap-5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg"
        >
          <ChartLine size={18} />
        </span>
        <div>
          <h2 id={headingId} className="font-display text-h3 text-text">
            Grounded in your data
          </h2>
          <p className="mt-1 text-caption text-text-muted">
            The coach advises in words; these figures are computed by the
            calculator, not the AI.
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="text-body-sm text-text-secondary">
          No activities yet, so there&rsquo;s nothing to ground the figures in.
          Log an activity and these numbers will fill in.
        </p>
      ) : (
        <dl className="flex flex-col gap-px overflow-hidden rounded-md bg-border">
          <div className="bg-surface-sunken px-4 py-3.5">
            <dt className="text-caption text-text-muted">
              Total footprint logged
            </dt>
            <dd className="numeric mt-1 text-h3 font-medium text-text">
              {grounding!.totalKg.toFixed(2)}{" "}
              <span className="text-body-sm font-normal text-text-muted">
                kg CO₂e
              </span>
            </dd>
          </div>

          <div className="bg-surface-sunken px-4 py-3.5">
            <dt className="text-caption text-text-muted">
              Biggest category so far
            </dt>
            <dd className="mt-1.5">
              {category ? (
                <span className="inline-flex items-center gap-1.5 text-body font-medium text-text">
                  <category.Icon
                    size={17}
                    className="shrink-0 text-brand-fg"
                    aria-hidden="true"
                  />
                  {category.label}
                </span>
              ) : (
                <span className="text-body text-text-secondary">—</span>
              )}
            </dd>
          </div>

          <div className="bg-surface-sunken px-4 py-3.5">
            <dt className="text-caption text-text-muted">Activities counted</dt>
            <dd className="numeric mt-1 text-body font-medium text-text">
              {grounding!.activityCount}
            </dd>
          </div>
        </dl>
      )}

      {hasData && grounding!.topInsightTitles.length > 0 && (
        <div>
          <h3 className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
            Top computed levers
          </h3>
          <ol className="mt-2.5 flex flex-col gap-2">
            {grounding!.topInsightTitles.map((title, i) => (
              <li
                key={title}
                className="flex items-start gap-2.5 text-body-sm text-text-secondary"
              >
                <span
                  aria-hidden="true"
                  className="numeric mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-surface-brand-subtle text-caption font-semibold text-brand-fg"
                >
                  {i + 1}
                </span>
                <span className="text-text">{title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="border-t border-border pt-4 text-caption text-text-muted">
        Every figure here is derived by our deterministic calculator from
        published emission factors.{" "}
        <Link
          href="/insights"
          className="rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        >
          See the ranked insights
        </Link>
        .
      </p>
    </Card>
  );
}
