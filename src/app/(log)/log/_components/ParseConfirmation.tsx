"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { previewActivities } from "@core/calculator/preview";
import type { PreviewRow } from "@core/calculator/preview";
import type { Locale, Unit } from "@core/schemas";
import { useAnnouncer } from "../../../_components/Announcer";
import { Badge } from "../../../_components/Badge";
import { EditableItemRow } from "./EditableItemRow";
import { TotalCard } from "./TotalCard";
import { findChoice, isKnownChoiceKey } from "./factorCatalog";

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

/**
 * Local input styling helper — intentionally distinct from the shared `Field`
 * control. Exported so the co-located `EditableItemRow` renders byte-identical
 * field markup.
 */
export const inputClass = (extra = "") =>
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
        transition={{ duration: 0.4, ease: EASE_OUT_QUART }}
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
          const itemId = `item-${reactId}-${index}`;
          return (
            <m.li
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.05 * index,
                ease: EASE_OUT_QUART,
              }}
            >
              <EditableItemRow
                item={item}
                row={row}
                itemId={itemId}
                onEditActivity={(value) => update(index, { activity: value })}
                onEditQuantity={(value) => update(index, { value })}
                onEditUnit={(unit) => update(index, { unit })}
                onResolve={(key) => resolveFactor(index, key)}
              />
            </m.li>
          );
        })}
      </ul>

      {/* Total + save gate — the floating instrument tile. */}
      <TotalCard
        totalKgDisplay={preview.totalKgDisplay}
        hasUnsourced={preview.hasUnsourced}
        sourcedCount={preview.sourcedCount}
        blockingCount={blockingCount}
        canSave={canSave}
        saving={saving}
        reasonId={`save-reason-${reactId}`}
        onSave={handleConfirm}
        onCancel={onCancel}
      />
    </section>
  );
}
