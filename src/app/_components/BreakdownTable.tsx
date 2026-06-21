import type { PreviewResult } from "@core/calculator/preview";
import { AlertTriangle, ArrowUpRight } from "./icons";

/**
 * Transparent baseline / log breakdown rendered as a real, accessible <table>:
 * the breakdown is a real <table> (qty, unit, factor, source, CO2e)
 * with caption + headers; the factor-source link has a descriptive accessible
 * name. Shared by Wizard Review, Parse Confirmation / fallback, and
 * reusable by the dashboard "show the math" surfaces.
 *
 * Numbers come ONLY from the calculator/preview module — never invented here.
 * Unsourced items (missing/unknown factor) are shown in their own row, clearly
 * marked with an ICON + TEXT (not colour alone — the `AlertTriangle` glyph plus
 * the warning copy) and EXCLUDED from the total (partial-state rule). All
 * figures use the mono tabular `.numeric` face.
 *
 * Soft rounded shell + `shadow-xs`, a visible
 * caption, zebra rows, the `AlertTriangle` / `ArrowUpRight` line icons in place of
 * the `⚠` glyph / bare external link, and tabular figures throughout. The
 * semantics — caption, scoped headers, the icon+text unsourced marking, the
 * sourced-only total, the descriptive source link — are unchanged.
 */

function fmtKg(n: number): string {
  return `${n.toFixed(2)} kg`;
}

export function BreakdownTable({
  result,
  caption = "Footprint breakdown by activity",
}: {
  result: PreviewResult;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface shadow-xs">
      <table className="w-full border-collapse text-body-sm">
        <caption className="px-4 pt-3 pb-2 text-left text-caption font-medium text-text-muted">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-border bg-surface-sunken text-left">
            <th scope="col" className="px-4 py-2.5 font-semibold text-text">
              Activity
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right font-semibold text-text"
            >
              Quantity
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold text-text">
              Factor &amp; source
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right font-semibold text-text"
            >
              CO₂e
            </th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => {
            if (row.status === "unsourced") {
              return (
                <tr
                  key={`unsourced-${i}`}
                  className="border-b border-border bg-warning-bg/40"
                >
                  <th
                    scope="row"
                    className="px-4 py-2.5 text-left font-medium text-text"
                  >
                    {row.activity ?? "Activity"}
                  </th>
                  <td className="numeric px-4 py-2.5 text-right tabular-nums text-text-secondary">
                    {row.inputValue} {row.inputUnit}
                  </td>
                  <td className="px-4 py-2.5" colSpan={2}>
                    <span className="inline-flex items-center gap-1.5 text-warning-fg">
                      <AlertTriangle
                        size={16}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        We can&rsquo;t source this yet — excluded from the
                        total.
                      </span>
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={`${row.candidateFactorKey}-${i}`}
                className="border-b border-border last:border-b-0 even:bg-surface-sunken/40"
              >
                <th
                  scope="row"
                  className="px-4 py-2.5 text-left font-medium text-text"
                >
                  {row.activity ?? row.candidateFactorKey}
                </th>
                <td className="numeric px-4 py-2.5 text-right tabular-nums text-text-secondary">
                  {row.inputValue} {row.inputUnit}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  <span className="block">
                    <span className="numeric tabular-nums">
                      {row.factorValue}
                    </span>{" "}
                    kg / {row.canonicalUnit}
                  </span>
                  <a
                    href={row.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 rounded-sm text-body-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                  >
                    {row.source.name} — {row.candidateFactorKey}
                    <ArrowUpRight
                      size={13}
                      className="shrink-0 opacity-70"
                      aria-hidden="true"
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </td>
                <td className="numeric px-4 py-2.5 text-right font-medium tabular-nums text-text">
                  {fmtKg(row.co2eKgDisplay)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-sunken">
            <th
              scope="row"
              colSpan={3}
              className="px-4 py-3 text-left font-semibold text-text"
            >
              Total{" "}
              {result.hasUnsourced && (
                <span className="text-body-sm font-normal text-warning-fg">
                  (sourced items only)
                </span>
              )}
            </th>
            <td className="numeric px-4 py-3 text-right text-h4 tabular-nums text-brand-active">
              {fmtKg(result.totalKgDisplay)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
