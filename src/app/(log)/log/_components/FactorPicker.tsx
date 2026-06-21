"use client";

import { AlertTriangle } from "../../../_components/icons";
import {
  CATEGORY_LABELS,
  FACTOR_CHOICES,
  type FactorChoice,
} from "./factorCatalog";

/**
 * Candidate-factor picker: a labelled radio group. Choosing a factor resolves the item
 * and unblocks save. Grouped by category for scanability.
 */
export function FactorPicker({
  idBase,
  selectedKey,
  onPick,
}: {
  idBase: string;
  selectedKey: string;
  onPick: (key: string) => void;
}) {
  const groups = Object.entries(CATEGORY_LABELS) as Array<
    [keyof typeof CATEGORY_LABELS, string]
  >;
  return (
    <fieldset className="mt-4 rounded-md border border-warning/40 bg-warning-bg p-4">
      <legend className="flex items-center gap-1.5 px-1 text-body-sm font-medium text-warning-fg">
        <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
        We couldn&rsquo;t match a source — pick the closest factor
      </legend>
      <p className="mt-1 text-caption text-text-secondary">
        Until you choose a source, this item is excluded from your total and
        can&rsquo;t be logged.
      </p>
      <div className="mt-3 space-y-3">
        {groups.map(([cat, label]) => {
          const choices: FactorChoice[] = FACTOR_CHOICES.filter(
            (c) => c.category === cat,
          );
          return (
            <div key={cat}>
              <p className="text-caption font-semibold uppercase tracking-[0.04em] text-text-muted">
                {label}
              </p>
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {choices.map((choice) => {
                  const inputId = `${idBase}-factor-${choice.key}`;
                  const selected = selectedKey === choice.key;
                  return (
                    <label
                      key={choice.key}
                      htmlFor={inputId}
                      className={[
                        "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-body-sm",
                        "transition-colors duration-fast ease-out-quart",
                        selected
                          ? "bg-surface text-text"
                          : "text-text hover:bg-surface-hover",
                      ].join(" ")}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`${idBase}-factor`}
                        value={choice.key}
                        checked={selected}
                        onChange={() => onPick(choice.key)}
                        className="h-4 w-4 shrink-0 border-border-interactive text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                      />
                      {choice.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
