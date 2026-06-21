import { TrendDataTable, type TrendTableRow } from "./ChartDataTable";
import type { TrendBucket } from "./bucketing";
import { TrendAreaGradientDef } from "./series";

/**
 * Footprint TREND over time. A single-series
 * hero chart: a confident `--brand` line with CIRCLE MARKERS, a soft brand-tinted
 * gradient AREA fill beneath it, and a dashed `--text-muted` TARGET reference
 * line. Color is never the only channel — the markers, the direct per-point value
 * labels, the target line, and the text summary all carry meaning without it.
 *
 * Subtle token-coloured
 * horizontal gridlines, a soft gradient area fill, a thicker confident line
 * weight with rounded joins, haloed markers (so points sit cleanly on the area),
 * Geist Mono tabular figures for every axis/value label, and an optional
 * `motion-safe:` stroke-dashoffset DRAW-IN. None of this touches the a11y model.
 *
 * Accessibility model — UNCHANGED:
 *  - The SVG is decorative: `aria-hidden` + `role="presentation"`. The REAL data
 *    is the keyboard-reachable <table> below (the primary SR experience).
 *  - A concise text SUMMARY sits in a labelled `role=status` region above it.
 *  - The chart renders to its FINAL state with no motion; the draw-in is
 *    `motion-safe:` only and the global reduced-motion rule disables it. Content
 *    is never gated on the animation.
 */

const W = 640;
const H = 240;
const PAD = { top: 22, right: 18, bottom: 30, left: 46 };
/** Number of horizontal gridlines (including baseline + top). */
const GRID_STEPS = 4;

function dayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function summarise(buckets: readonly TrendBucket[]): string {
  if (buckets.length === 0) {
    return "No footprint data yet.";
  }
  if (buckets.length === 1) {
    const only = buckets[0]!;
    return `One day logged: ${only.totalKg.toFixed(2)} kg CO₂e on ${dayLabel(only.dayKey)}.`;
  }
  const first = buckets[0]!.totalKg;
  const last = buckets[buckets.length - 1]!.totalKg;
  const deltaPct = first === 0 ? 0 : ((last - first) / first) * 100;
  const dir = deltaPct < 0 ? "down" : deltaPct > 0 ? "up" : "unchanged";
  const magnitude = Math.abs(deltaPct).toFixed(0);
  const span = `${dayLabel(buckets[0]!.dayKey)} to ${dayLabel(buckets[buckets.length - 1]!.dayKey)}`;
  return deltaPct === 0
    ? `Trend: footprint unchanged across ${buckets.length} logged days (${span}).`
    : `Trend: footprint ${dir} ${magnitude}% across ${buckets.length} logged days (${span}), from ${first.toFixed(2)} to ${last.toFixed(2)} kg CO₂e.`;
}

export function TrendChart({
  buckets,
  targetKg,
  titleId,
}: {
  buckets: readonly TrendBucket[];
  targetKg?: number;
  titleId: string;
}) {
  const summary = summarise(buckets);
  const tableRows: TrendTableRow[] = buckets.map((b) => ({
    dayKey: b.dayKey,
    label: dayLabel(b.dayKey),
    totalKg: b.totalKg,
  }));

  const maxValue = Math.max(1, ...buckets.map((b) => b.totalKg), targetKg ?? 0);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  function x(i: number): number {
    if (buckets.length <= 1) {
      return PAD.left + innerW / 2;
    }
    return PAD.left + (i / (buckets.length - 1)) * innerW;
  }
  function y(value: number): number {
    return PAD.top + innerH - (value / maxValue) * innerH;
  }

  const points = buckets.map((b, i) => ({ cx: x(i), cy: y(b.totalKg), b }));
  // Axis-label density: the fixed 640-wide viewBox scales to ~343px on a phone,
  // so once there are many points the per-point value + day labels overlap. Show
  // a label only every `labelStep` points (always the first and last), keeping
  // the axis readable on small screens. The full per-day data is in the table.
  const labelStep = buckets.length > 12 ? 3 : buckets.length > 7 ? 2 : 1;
  function showLabel(i: number): boolean {
    return i % labelStep === 0 || i === 0 || i === buckets.length - 1;
  }
  const linePath = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`,
    )
    .join(" ");
  // Closed area under the line, down to the baseline (the soft gradient fill).
  const baselineY = PAD.top + innerH;
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1]!.cx.toFixed(1)},${baselineY.toFixed(1)} L${points[0]!.cx.toFixed(1)},${baselineY.toFixed(1)} Z`
      : "";
  // Approximate path length for the draw-in dash (over-estimate is fine — the
  // dash just needs to fully hide then reveal the polyline).
  const lineLength = Math.round(innerW + innerH) * 2;
  const gradientId = `${titleId}-area`;

  // Evenly spaced horizontal gridlines (top → baseline), value-labelled at left.
  const grid = Array.from({ length: GRID_STEPS + 1 }, (_, k) => {
    const value = (maxValue * (GRID_STEPS - k)) / GRID_STEPS;
    return { value, gy: y(value), isBaseline: k === GRID_STEPS };
  });

  return (
    <div>
      <p
        role="status"
        className="text-body-sm text-text-secondary"
        data-testid="trend-summary"
      >
        {summary}
      </p>

      {buckets.length > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="presentation"
          aria-hidden="true"
          focusable="false"
          className="mt-4 h-auto w-full overflow-visible"
        >
          <TrendAreaGradientDef id={gradientId} />

          {/* Subtle horizontal gridlines + left-edge value scale (tabular). */}
          {grid.map((g, k) => (
            <g key={`grid-${k}`}>
              <line
                x1={PAD.left}
                y1={g.gy}
                x2={W - PAD.right}
                y2={g.gy}
                stroke="var(--border)"
                strokeWidth={1}
                opacity={g.isBaseline ? 1 : 0.55}
              />
              <text
                x={PAD.left - 8}
                y={g.gy}
                textAnchor="end"
                dominantBaseline="middle"
                className="numeric"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {g.value.toFixed(g.value < 10 ? 1 : 0)}
              </text>
            </g>
          ))}

          {targetKg !== undefined && targetKg <= maxValue && (
            <>
              <line
                x1={PAD.left}
                y1={y(targetKg)}
                x2={W - PAD.right}
                y2={y(targetKg)}
                stroke="var(--text-muted)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              <text
                x={W - PAD.right}
                y={y(targetKg) - 5}
                textAnchor="end"
                className="numeric"
                fontSize={11}
                fontWeight={500}
                fill="var(--text-muted)"
              >
                Target {targetKg.toFixed(1)} kg
              </text>
            </>
          )}

          {/* Soft gradient area fill (decorative; meaning is in line + table). */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={lineLength}
              className="motion-safe:animate-draw-in"
              style={{ ["--draw-length" as string]: String(lineLength) }}
            />
          )}

          {points.map((p, i) => (
            <g key={p.b.dayKey}>
              {/* haloed circle marker — the non-colour series cue, kept crisp on
                  the gradient area with a surface-coloured ring. */}
              <circle
                cx={p.cx}
                cy={p.cy}
                r={4.5}
                fill="var(--brand)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
              {/* direct value + day label (tabular figures). Thinned on dense
                  series so labels don't collide once the viewBox is scaled to a
                  phone; the full per-day values remain in the data table. */}
              {showLabel(i) && (
                <text
                  x={p.cx}
                  y={p.cy - 11}
                  textAnchor="middle"
                  className="numeric"
                  fontSize={12}
                  fontWeight={500}
                  fill="var(--text)"
                >
                  {p.b.totalKg.toFixed(1)}
                </text>
              )}
              {showLabel(i) && (
                <text
                  x={x(i)}
                  y={H - 9}
                  textAnchor="middle"
                  className="numeric"
                  fontSize={12}
                  fill="var(--text-muted)"
                >
                  {dayLabel(p.b.dayKey)}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}

      <div className="mt-4">
        <h4 className="sr-only" id={`${titleId}-table`}>
          Footprint trend data table
        </h4>
        <TrendDataTable
          caption="Footprint per logged day, in kilograms of CO₂e."
          rows={tableRows}
        />
      </div>
    </div>
  );
}
