import { CategoryDataTable, type CategoryTableRow } from "./ChartDataTable";
import type { CategoryTotal } from "./bucketing";
import {
  CATEGORY_LABELS,
  CATEGORY_SERIES,
  SeriesMarker,
  SeriesPatternDefs,
} from "./series";

/**
 * CATEGORY breakdown ("Category breakdown bars"). Horizontal
 * bars filled with each series' PATTERN (SVG <pattern>, not just colour) and a
 * DIRECT end-label "0.0 kg"; bars sorted descending.
 *
 * Softly rounded sunken tracks, pattern-
 * filled bars with a crisp colour outline and `rounded` corners, Geist Mono
 * tabular figures on every value, and an optional `motion-safe:` width DRAW-IN
 * (a transform scaleX from the bar's left edge — GPU-cheap, reduced-motion safe).
 * The non-colour encoding is untouched: shape + SVG pattern + words still carry
 * the series identity.
 *
 * Accessibility model — UNCHANGED: the SVG is decorative (`aria-hidden` +
 * presentation); the keyboard-reachable <table> is the primary SR experience, and
 * a non-colour marker/pattern legend (marker SHAPE + pattern WORDS) sits beside
 * the bars. A `role=status` text summary names the top contributor without
 * relying on bar length or colour.
 */

const W = 640;
const ROW_H = 46;
const PAD = { top: 10, right: 16, bottom: 10, left: 16 };
// Category-name gutter. Tightened from 150 → 132 so that when the fixed 640-wide
// viewBox is scaled down to a ~343px phone, the bars + end value-labels keep room
// and don't crowd against the names (the labels are the shortest category words).
const LABEL_W = 132;
const BAR_X = PAD.left + LABEL_W;
// End-value gutter (the "0.0 kg" labels). Slightly tightened with LABEL_W.
const VALUE_GUTTER = 88;

function summarise(totals: readonly CategoryTotal[], totalKg: number): string {
  if (totals.length === 0) {
    return "No category data yet.";
  }
  const top = totals[0]!;
  const share = totalKg === 0 ? 0 : (top.totalKg / totalKg) * 100;
  return `Biggest contributor: ${CATEGORY_LABELS[top.category]} at ${top.totalKg.toFixed(2)} kg CO₂e (${share.toFixed(0)}% of ${totalKg.toFixed(2)} kg total) across ${totals.length} categor${totals.length === 1 ? "y" : "ies"}.`;
}

export function CategoryChart({
  totals,
  titleId,
}: {
  totals: readonly CategoryTotal[];
  titleId: string;
}) {
  const totalKg = totals.reduce((s, t) => s + t.totalKg, 0);
  const maxValue = Math.max(1, ...totals.map((t) => t.totalKg));
  const summary = summarise(totals, totalKg);

  const tableRows: CategoryTableRow[] = totals.map((t) => ({
    category: t.category,
    totalKg: t.totalKg,
    sharePct: totalKg === 0 ? 0 : (t.totalKg / totalKg) * 100,
  }));

  const innerBarW = W - BAR_X - PAD.right - VALUE_GUTTER;
  const svgH = PAD.top + totals.length * ROW_H + PAD.bottom;

  return (
    <div>
      <p
        role="status"
        className="text-body-sm text-text-secondary"
        data-testid="category-summary"
      >
        {summary}
      </p>

      {/* Non-colour legend: marker shape + pattern words + label. Tighter
          horizontal gap on phones so chips don't wrap awkwardly at 320–375px. */}
      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2 sm:gap-x-5">
        {totals.map((t) => (
          <li
            key={t.category}
            className="inline-flex items-center gap-1.5 rounded-pill bg-surface-sunken px-2.5 py-1 text-caption text-text-secondary"
          >
            <SeriesMarker category={t.category} size={13} />
            <span className="font-medium text-text">
              {CATEGORY_LABELS[t.category]}
            </span>
            <span className="text-text-muted">
              ({CATEGORY_SERIES[t.category].patternLabel})
            </span>
          </li>
        ))}
      </ul>

      {totals.length > 0 && (
        <svg
          viewBox={`0 0 ${W} ${svgH}`}
          width="100%"
          role="presentation"
          aria-hidden="true"
          focusable="false"
          className="mt-4 h-auto w-full"
        >
          <SeriesPatternDefs />
          {totals.map((t, i) => {
            const s = CATEGORY_SERIES[t.category];
            const yTop = PAD.top + i * ROW_H + 9;
            const barH = ROW_H - 24;
            const barW = Math.max(3, (t.totalKg / maxValue) * innerBarW);
            // Width draw-in: scaleX from the bar's left edge (transform-only).
            const drawStyle = {
              transformBox: "fill-box",
              transformOrigin: "left center",
            } as const;
            return (
              <g key={t.category}>
                <text
                  x={PAD.left}
                  y={yTop + barH / 2}
                  dominantBaseline="middle"
                  fontSize={14}
                  fontWeight={500}
                  fill="var(--text)"
                >
                  {CATEGORY_LABELS[t.category]}
                </text>
                {/* track */}
                <rect
                  x={BAR_X}
                  y={yTop}
                  width={innerBarW}
                  height={barH}
                  rx={6}
                  fill="var(--surface-sunken)"
                />
                {/* pattern-filled bar (non-colour geometry) + a colour outline */}
                <rect
                  x={BAR_X}
                  y={yTop}
                  width={barW}
                  height={barH}
                  rx={6}
                  fill={`url(#${s.patternId})`}
                  stroke={s.vizVar}
                  strokeWidth={1.5}
                  className="motion-safe:animate-[draw-bar_640ms_cubic-bezier(0.32,0.72,0,1)_both]"
                  style={drawStyle}
                />
                {/* direct end-label: value (tabular figures) */}
                <text
                  x={BAR_X + barW + 9}
                  y={yTop + barH / 2}
                  dominantBaseline="middle"
                  className="numeric"
                  fontSize={13}
                  fontWeight={500}
                  fill="var(--text)"
                >
                  {t.totalKg.toFixed(1)} kg
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <div className="mt-4">
        <h4 className="sr-only" id={`${titleId}-table`}>
          Category breakdown data table
        </h4>
        <CategoryDataTable
          caption="Footprint by category, in kilograms of CO₂e, with each category's share of the total."
          rows={tableRows}
        />
      </div>
    </div>
  );
}
