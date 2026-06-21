import type { Streak } from "@core/schemas";
import { Ripple } from "../../../_components/icons";

/** Logging-streak readout: current count, longest, and the local-day reset rule. */
export function StreakDisplay({ streak }: { streak: Streak | null }) {
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
