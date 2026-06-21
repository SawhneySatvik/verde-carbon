"use client";

import { Card } from "../../../_components/Card";
import { Ripple } from "../../../_components/icons";

/**
 * StreakExplainer — resting card stating the streak rule, with the display-size
 * count + day(s) pluralization. Count and heading id arrive from the parent.
 */

export function StreakExplainer({
  count,
  headingId,
}: {
  count: number;
  headingId: string;
}) {
  return (
    <Card as="div" pad="lg">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg"
        >
          <Ripple size={18} />
        </span>
        <h2 id={headingId} className="font-display text-h3 text-text">
          How your streak works
        </h2>
      </div>
      <p className="mt-4 flex items-baseline gap-2.5">
        <span className="numeric font-display text-display text-brand-active">
          {count}
        </span>
        <span className="font-display text-h3 text-text-muted">
          day{count === 1 ? "" : "s"}
        </span>
      </p>
      <p className="mt-3 max-w-[60ch] text-pretty text-body text-text-secondary">
        Your streak counts each calendar day you log an activity, measured in
        your local time zone. Log on consecutive days and it grows; miss a full
        day and it restarts at one. We always show the change — a streak is
        never reset silently.
      </p>
    </Card>
  );
}
