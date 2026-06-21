import type { Category } from "@core/schemas";
import { CATEGORY_LABELS, CATEGORY_SERIES, SeriesMarker } from "./series";

/**
 * The keyboard-reachable, screen-reader-PRIMARY data-table fallback for every
 * dashboard chart. Every chart has a data-table fallback — the same
 * data as an accessible <table> with <caption>, header cells, and scope —
 * reachable by keyboard and exposed to screen readers; this is the primary SR
 * experience for the chart.
 *
 * The visual chart is marked aria-hidden by its container; THIS table carries the
 * real semantics. It stays a real semantic `<table>`, fully present:
 *  - a `<caption>` (visually shown as a small label, never `sr-only`-hidden),
 *  - `scope`d column + row header cells,
 *  - Geist Mono tabular figures for every numeral,
 *  - a non-colour cue (marker SHAPE + pattern WORDS) beside each category, so the
 *    table itself never relies on colour either.
 *
 * Purely presentational (surface tints, zebra rows, rounded shell);
 * none of the semantics, headers, scope, or non-colour columns change.
 */

function fmtKg(n: number): string {
  return `${n.toFixed(2)} kg`;
}

/** Shared table chrome. */
const SHELL =
  "overflow-x-auto rounded-md border border-border bg-surface shadow-xs";
const TABLE = "w-full border-collapse text-body-sm";
const CAPTION =
  "px-4 pt-3 pb-2 text-left text-caption font-medium text-text-muted";
const HEAD_ROW = "border-b border-border bg-surface-sunken text-left";
const TH_COL = "px-4 py-2.5 font-semibold text-text";
const TH_ROW = "px-4 py-2.5 text-left font-medium text-text";
const ROW = "border-b border-border last:border-b-0 even:bg-surface-sunken/40";

export interface TrendTableRow {
  dayKey: string;
  label: string;
  totalKg: number;
}

/** Data table for the single-series footprint trend (one row per local day). */
export function TrendDataTable({
  caption,
  rows,
  unitLabel = "kg CO₂e",
}: {
  caption: string;
  rows: readonly TrendTableRow[];
  unitLabel?: string;
}) {
  return (
    <div className={SHELL}>
      <table className={TABLE}>
        <caption className={CAPTION}>{caption}</caption>
        <thead>
          <tr className={HEAD_ROW}>
            <th scope="col" className={TH_COL}>
              Day
            </th>
            <th scope="col" className={`${TH_COL} text-right`}>
              Footprint ({unitLabel})
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dayKey} className={ROW}>
              <th scope="row" className={TH_ROW}>
                {row.label}
              </th>
              <td className="numeric px-4 py-2.5 text-right tabular-nums text-text">
                {fmtKg(row.totalKg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface CategoryTableRow {
  category: Category;
  totalKg: number;
  sharePct: number;
}

/** Data table for the category-breakdown bars (one row per category). */
export function CategoryDataTable({
  caption,
  rows,
}: {
  caption: string;
  rows: readonly CategoryTableRow[];
}) {
  return (
    <div className={SHELL}>
      <table className={TABLE}>
        <caption className={CAPTION}>{caption}</caption>
        <thead>
          <tr className={HEAD_ROW}>
            <th scope="col" className={TH_COL}>
              Category
            </th>
            <th scope="col" className={TH_COL}>
              Pattern
            </th>
            <th scope="col" className={`${TH_COL} text-right`}>
              Footprint
            </th>
            <th scope="col" className={`${TH_COL} text-right`}>
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category} className={ROW}>
              <th scope="row" className={TH_ROW}>
                <span className="inline-flex items-center gap-2">
                  <SeriesMarker category={row.category} size={13} />
                  {CATEGORY_LABELS[row.category]}
                </span>
              </th>
              <td className="px-4 py-2.5 text-text-secondary">
                {CATEGORY_SERIES[row.category].patternLabel}
              </td>
              <td className="numeric px-4 py-2.5 text-right tabular-nums text-text">
                {fmtKg(row.totalKg)}
              </td>
              <td className="numeric px-4 py-2.5 text-right tabular-nums text-text-secondary">
                {row.sharePct.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
