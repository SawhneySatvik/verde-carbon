"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { m } from "motion/react";
import { previewActivities } from "@core/calculator/preview";
import type { PreviewBreakdownRow, PreviewRow } from "@core/calculator/preview";
import type { Locale, Unit } from "@core/schemas";
import { UNIT_VOCABULARY } from "@core/schemas";
import { useAnnouncer } from "../../../_components/Announcer";
import { Badge } from "../../../_components/Badge";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { ShowTheMath } from "../../../_components/ShowTheMath";
import { AlertTriangle, CheckCircle, Lock } from "../../../_components/icons";
import {
  CATEGORY_LABELS,
  FACTOR_CHOICES,
  findChoice,
  isKnownChoiceKey,
  type FactorChoice,
} from "./factorCatalog";

/**
 * Parse Confirmation — the load-bearing "show before save" surface.
 *
 * Renders the parsed items as EDITABLE labelled fields and the per-item + total
 * CO2e computed by the CLIENT-IMPORTABLE preview module (previewActivities,
 * imported directly). NOTHING is persisted here: the component never
 * writes; only the parent's `onConfirm` (wired to the non-preview POST)
 * persists, and only when the user clicks "Log it".
 *
 * Any item whose factor is unknown/unsourced highlights its factor control and
 * is shown a candidate-factor picker; "Log it" is DISABLED-with-reason
 * (announced) until every item resolves.
 *
 * Look: each parsed item is a resting Double-Bezel `Card`; the running total +
 * save gate is a raised, brand-accented `Card` with the hero CO₂e figure in
 * tabular mono. Items fade/rise in on mount with a small list stagger (`m`,
 * transform/opacity only → reduced-motion safe). All form semantics, the
 * heading/ref/tabIndex focus target, announcements, ≥44px targets, and the
 * save-blocking gate are preserved verbatim.
 */

export interface EditableItem {
  activity: string;
  value: string;
  unit: Unit;
  candidateFactorKey: string;
  /** True when the parser's matched factor was unknown/low-confidence. */
  needsFactor: boolean;
}

const ease = [0.16, 1, 0.3, 1] as const;

const inputClass = (extra = "") =>
  [
    "block w-full min-h-[44px] rounded-xs border border-border-strong bg-surface px-3.5 py-2.5 text-body text-text",
    "placeholder:text-text-muted transition-colors duration-fast ease-out-quart",
    "hover:border-border-interactive focus-visible:border-brand focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");

function toEditable(
  items: ReadonlyArray<{
    activity: string;
    value: number;
    unit: Unit;
    candidateFactorKey: string;
  }>,
): EditableItem[] {
  return items.map((it) => ({
    activity: it.activity,
    value: String(it.value),
    unit: it.unit,
    candidateFactorKey: it.candidateFactorKey,
    needsFactor: !isKnownChoiceKey(it.candidateFactorKey),
  }));
}

export function ParseConfirmation({
  parsedItems,
  locale = "US",
  saving = false,
  onConfirm,
  onCancel,
  headingRef,
}: {
  parsedItems: ReadonlyArray<{
    activity: string;
    value: number;
    unit: Unit;
    candidateFactorKey: string;
  }>;
  locale?: Locale;
  saving?: boolean;
  onConfirm: (
    items: ReadonlyArray<{
      activity: string;
      value: number;
      unit: Unit;
      candidateFactorKey: string;
    }>,
  ) => void;
  onCancel: () => void;
  /**
   * Optional ref to the section heading so the parent can move focus here when
   * the flow transitions INTO the confirm phase (WCAG 2.4.3 Focus Order). The
   * heading carries `tabIndex={-1}` to be programmatically focusable.
   */
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const { announce } = useAnnouncer();
  const reactId = useId();
  const [items, setItems] = useState<EditableItem[]>(() =>
    toEditable(parsedItems),
  );

  // Re-seed when a fresh parse arrives.
  useEffect(() => {
    setItems(toEditable(parsedItems));
  }, [parsedItems]);

  const calcInputs = useMemo(
    () =>
      items.map((it) => ({
        activity: it.activity,
        candidateFactorKey: it.candidateFactorKey,
        value: Number(it.value),
        unit: it.unit,
      })),
    [items],
  );

  const preview = useMemo(
    () => previewActivities(calcInputs, { locale }),
    [calcInputs, locale],
  );

  // Announce the recomputed total whenever it changes (aria-live for
  // dynamic CO2e updates).
  useEffect(() => {
    announce(
      `Computed total: ${preview.totalKgDisplay.toFixed(2)} kilograms CO2e from ${preview.sourcedCount} sourced item${preview.sourcedCount === 1 ? "" : "s"}.`,
    );
  }, [preview.totalKgDisplay, preview.sourcedCount, announce]);

  const blockingCount = preview.unsourcedCount;
  const canSave = blockingCount === 0 && preview.sourcedCount > 0 && !saving;

  function update(index: number, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function resolveFactor(index: number, key: string) {
    const choice = findChoice(key);
    update(index, {
      candidateFactorKey: key,
      needsFactor: false,
      ...(choice ? { unit: choice.inputUnit } : {}),
    });
    if (choice) {
      announce(`Factor set to ${choice.label}. Recomputing.`);
    }
  }

  function handleConfirm() {
    if (!canSave) {
      announce(
        `Can't log yet: ${blockingCount} item${blockingCount === 1 ? "" : "s"} still need a source.`,
        "assertive",
      );
      return;
    }
    onConfirm(
      items.map((it) => ({
        activity: it.activity,
        value: Number(it.value),
        unit: it.unit,
        candidateFactorKey: it.candidateFactorKey,
      })),
    );
  }

  // Pair each editable item with its computed preview row (same order).
  const rows: Array<{ item: EditableItem; row: PreviewRow }> = items.map(
    (item, i) => ({ item, row: preview.rows[i]! }),
  );

  return (
    <section aria-labelledby={`confirm-title-${reactId}`} className="space-y-6">
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <Badge tone="brand" eyebrow>
          Review before saving
        </Badge>
        <h2
          id={`confirm-title-${reactId}`}
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-balance font-display text-h2 tracking-[-0.01em] text-text focus:outline-none"
        >
          Check this before you save
        </h2>
        <p className="mt-3 max-w-[58ch] text-pretty text-body text-text-secondary">
          We parsed your activity into the items below. The CO₂e is computed by
          our calculator from published factors. Edit anything that&rsquo;s off
          — nothing is saved until you choose <strong>Log it</strong>.
        </p>
      </m.div>

      <ul className="space-y-4">
        {rows.map(({ item, row }, index) => {
          const resolved = row.status === "resolved";
          const itemId = `item-${reactId}-${index}`;
          return (
            <m.li
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * index, ease }}
            >
              <Card
                elevation="rest"
                accent={resolved ? "none" : "warning"}
                pad="md"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge
                    tone={resolved ? "brand" : "warning"}
                    icon={
                      resolved ? (
                        <CheckCircle size={13} />
                      ) : (
                        <AlertTriangle size={13} />
                      )
                    }
                  >
                    {resolved ? "Sourced" : "Needs a source"}
                  </Badge>
                  {resolved ? (
                    <p className="numeric text-h3 leading-none text-brand-active">
                      {(row as PreviewBreakdownRow).co2eKgDisplay.toFixed(2)}
                      <span className="ml-1 text-body-sm font-normal text-text-secondary">
                        kg CO₂e
                      </span>
                    </p>
                  ) : (
                    <p className="text-body-sm text-text-muted">
                      Not yet counted
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${itemId}-activity`}
                      className="text-caption font-medium text-text-secondary"
                    >
                      Activity
                    </label>
                    <input
                      id={`${itemId}-activity`}
                      type="text"
                      value={item.activity}
                      onChange={(e) =>
                        update(index, { activity: e.target.value })
                      }
                      className={inputClass()}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${itemId}-qty`}
                      className="text-caption font-medium text-text-secondary"
                    >
                      Quantity
                    </label>
                    <input
                      id={`${itemId}-qty`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={item.value}
                      onChange={(e) => update(index, { value: e.target.value })}
                      className={inputClass("numeric")}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${itemId}-unit`}
                      className="text-caption font-medium text-text-secondary"
                    >
                      Unit
                    </label>
                    <select
                      id={`${itemId}-unit`}
                      value={item.unit}
                      onChange={(e) =>
                        update(index, { unit: e.target.value as Unit })
                      }
                      className={inputClass()}
                    >
                      {UNIT_VOCABULARY.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Factor + source / picker. */}
                {resolved ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-body-sm text-text-secondary">
                      Factor:{" "}
                      <span className="font-medium text-text">
                        {findChoice(item.candidateFactorKey)?.label ??
                          item.candidateFactorKey}
                      </span>
                    </p>
                    <div className="mt-2">
                      <ShowTheMath row={row as PreviewBreakdownRow} />
                    </div>
                  </div>
                ) : (
                  <FactorPicker
                    idBase={itemId}
                    selectedKey={item.candidateFactorKey}
                    onPick={(key) => resolveFactor(index, key)}
                  />
                )}
              </Card>
            </m.li>
          );
        })}
      </ul>

      {/* Total + save gate — the floating instrument tile. */}
      <Card elevation="raised" accent="brand" pad="lg">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-caption uppercase tracking-[0.06em] text-text-muted">
              Running total
              {preview.hasUnsourced && (
                <span className="font-medium normal-case tracking-normal text-warning-fg">
                  (sourced items only)
                </span>
              )}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span
                className="numeric text-display leading-none text-brand-active"
                aria-hidden="true"
              >
                {preview.totalKgDisplay.toFixed(2)}
              </span>
              <span className="text-body text-text-secondary">kg CO₂e</span>
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-body-sm text-text-muted">
              <Lock size={14} className="shrink-0" aria-hidden="true" />
              Not saved yet — review, then log it.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              loading={saving}
              disabled={!canSave && !saving}
              aria-disabled={!canSave}
              aria-describedby={!canSave ? `save-reason-${reactId}` : undefined}
            >
              {saving ? "Logging…" : "Log it"}
            </Button>
          </div>
        </div>

        {!canSave && !saving && (
          <p
            id={`save-reason-${reactId}`}
            className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-body-sm text-warning-fg"
          >
            <AlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              {preview.sourcedCount === 0
                ? "Add at least one sourceable item to log."
                : `${blockingCount} item${blockingCount === 1 ? "" : "s"} still need a source — pick a factor above to continue.`}
            </span>
          </p>
        )}
      </Card>
    </section>
  );
}

/**
 * Candidate-factor picker: a labelled radio group. Choosing a factor resolves the item
 * and unblocks save. Grouped by category for scanability.
 */
function FactorPicker({
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
