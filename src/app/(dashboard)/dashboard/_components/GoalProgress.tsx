import type { Goal } from "@core/schemas";
import { ArrowUp, CheckCircle } from "../../../_components/icons";

/**
 * Goal-progress indicator. Progress is the
 * reduction ACHIEVED vs the target reduction, computed from logged data vs the
 * goal's baseline. It is text-first: the headline is a labelled number and an
 * explicit on-track / over-budget state with an ICON + WORDS — never colour
 * alone.
 *
 * `role="progressbar"` carries `aria-valuenow/min/max` + an `aria-label`.
 * The visual ring is decorative (`aria-hidden`).
 *
 * The over-budget `▲` / on-track `✓` Unicode
 * glyphs become the `ArrowUp` / `CheckCircle` line icons (still `aria-hidden`;
 * the WORDS carry the meaning), and the ring gets a soft `motion-safe:`
 * stroke-dashoffset draw-in. The non-colour encoding + a11y model are unchanged.
 */

const R = 52;
const STROKE = 10;
const CIRC = 2 * Math.PI * R;

export function GoalProgress({
  goal,
  currentKg,
}: {
  goal: Goal;
  currentKg: number;
}) {
  // Target absolute footprint = baseline reduced by targetPct.
  const targetKg = goal.baselineKg * (1 - goal.targetPct / 100);
  const reductionTargetKg = goal.baselineKg - targetKg;
  const reductionAchievedKg = goal.baselineKg - currentKg;
  const progressPct =
    reductionTargetKg <= 0
      ? 0
      : Math.max(
          0,
          Math.min(100, (reductionAchievedKg / reductionTargetKg) * 100),
        );
  const overBudget = currentKg > goal.baselineKg;
  const valueNow = Math.round(progressPct);
  const dashOffset = CIRC * (1 - progressPct / 100);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg
          width={128}
          height={128}
          viewBox="0 0 128 128"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx={64}
            cy={64}
            r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />
          <circle
            cx={64}
            cy={64}
            r={R}
            fill="none"
            stroke={overBudget ? "var(--danger)" : "var(--brand)"}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 64 64)"
            className="motion-safe:animate-draw-in"
            style={{ ["--draw-length" as string]: String(dashOffset) }}
          />
        </svg>
        <span
          className="numeric absolute inset-0 flex items-center justify-center text-h3 text-text"
          aria-hidden="true"
        >
          {valueNow}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={valueNow}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Goal progress: ${valueNow} percent of your ${goal.targetPct} percent reduction target`}
      >
        <p className="text-h4 text-text">
          {goal.targetPct}% reduction goal ({goal.period})
        </p>
        {overBudget ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-body-sm font-medium text-danger-fg">
            <ArrowUp size={16} className="shrink-0" aria-hidden="true" />
            Over your baseline — emissions are up, not down.
          </p>
        ) : (
          <p className="mt-1 text-body-sm text-text-secondary">
            {valueNow >= 100 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success-fg">
                <CheckCircle
                  size={16}
                  className="shrink-0"
                  aria-hidden="true"
                />
                Target reached.
              </span>
            ) : (
              <>
                <span className="numeric">{currentKg.toFixed(1)} kg</span> so
                far vs a target of{" "}
                <span className="numeric">{targetKg.toFixed(1)} kg</span>.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
