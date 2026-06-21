"use client";

import { useId, useState } from "react";
import type { PreviewBreakdownRow } from "@core/calculator/preview";
import { ArrowUpRight, ChevronDown, ChevronRight } from "./icons";

/**
 * "Show the math" provenance panel for a single computed number. Every number is
 * inspectable → inputs → factor → source link → arithmetic, with a data-table
 * view. Shared by Parse Confirmation / fallback and reusable by the dashboard
 * "show the math" affordances.
 *
 * The trigger is a real <button> with a descriptive accessible name; the panel
 * is a disclosure (aria-expanded + aria-controls). The arithmetic is TEXT, never
 * an image. Provenance opens in context — no navigation away from the task.
 *
 * The `▸`/`▾` Unicode glyph is replaced by the `ChevronRight` /
 * `ChevronDown` line icons (still `aria-hidden`, the disclosure state is on the
 * button via `aria-expanded`); the panel uses the sunken surface + tabular
 * figures. The disclosure semantics are unchanged.
 */
export function ShowTheMath({ row }: { row: PreviewBreakdownRow }) {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const panelId = `math-${reactId}`;
  const label = row.activity ?? row.candidateFactorKey;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-2 py-1 text-body-sm font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
      >
        {open ? (
          <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
        )}
        Show the math
        <span className="sr-only"> for {label}</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="mt-2 rounded-md border border-border bg-surface-sunken p-4 text-body-sm shadow-xs"
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-text-muted">Your input</dt>
            <dd className="numeric tabular-nums text-text">
              {row.inputValue} {row.inputUnit}
            </dd>

            <dt className="text-text-muted">Converted to</dt>
            <dd className="numeric tabular-nums text-text">
              {row.canonicalQuantity.toFixed(4)} {row.canonicalUnit}
            </dd>

            <dt className="text-text-muted">Factor</dt>
            <dd className="numeric tabular-nums text-text">
              {row.factorValue} kg / {row.canonicalUnit}
            </dd>

            <dt className="text-text-muted">Source</dt>
            <dd>
              <a
                href={row.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                {row.source.name} — {row.candidateFactorKey}
                <ArrowUpRight
                  size={13}
                  className="shrink-0 opacity-70"
                  aria-hidden="true"
                />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className="block text-caption text-text-muted">
                {row.factorSet === "EPA" ? "EPA" : "UK DEFRA/DESNZ"} ·{" "}
                {row.source.edition} · {row.factorSetVersion}
              </span>
            </dd>
          </dl>

          <p className="numeric mt-3 border-t border-border pt-3 tabular-nums text-text">
            {row.canonicalQuantity.toFixed(4)} {row.canonicalUnit} ×{" "}
            {row.factorValue} kg/{row.canonicalUnit} ={" "}
            <strong className="text-brand-active">
              {row.co2eKgDisplay.toFixed(2)} kg CO₂e
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}
