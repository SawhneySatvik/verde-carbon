"use client";

import { useId, useState } from "react";
import type { Category, Unit } from "@core/schemas";
import { Badge } from "../../../_components/Badge";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { Field, Input, inputClass } from "../../../_components/Field";
import { AlertCircle, ArrowUpRight } from "../../../_components/icons";
import {
  CATEGORY_LABELS,
  choicesForCategory,
  findChoice,
  FACTOR_CHOICES,
} from "./factorCatalog";

/**
 * Structured Fallback Form. AI-free logging: category → activity (a
 * seeded factor) → quantity → unit. It produces the SAME shape of parsed item
 * the NL path does, so the result flows into the SAME Parse Confirmation
 * breakdown and the SAME calculator — the loop never blocks on AI.
 *
 * Reachable directly (not only as an error fallback) for keyboard/SR users who
 * prefer it. Built from the `Field` / `Input` primitives inside the
 * Double-Bezel `Card`; the selects reuse the shared `inputClass` so every
 * control shares one resting/hover/focus material. Validation preserves input
 * and moves focus to the first invalid field. All labels,
 * error semantics, ≥44px targets, and test hooks are preserved verbatim.
 */
export function FallbackForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (
    items: ReadonlyArray<{
      activity: string;
      value: number;
      unit: Unit;
      candidateFactorKey: string;
    }>,
  ) => void;
  onCancel?: () => void;
}) {
  const reactId = useId();
  const [category, setCategory] = useState<Category>("transport");
  const [factorKey, setFactorKey] = useState<string>(
    choicesForCategory("transport")[0]?.key ?? FACTOR_CHOICES[0]!.key,
  );
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);

  const choice = findChoice(factorKey);
  const choices = choicesForCategory(category);

  const catId = `fallback-cat-${reactId}`;
  const factorId = `fallback-factor-${reactId}`;
  const qtyId = `fallback-qty-${reactId}`;
  const qtyErrorId = `${qtyId}-error`;

  function handleCategory(next: Category) {
    setCategory(next);
    const first = choicesForCategory(next)[0];
    if (first) {
      setFactorKey(first.key);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(quantity);
    if (quantity.trim() === "" || !Number.isFinite(value) || value <= 0) {
      setError("Enter a quantity greater than zero.");
      document.getElementById(qtyId)?.focus();
      return;
    }
    setError(null);
    const picked = findChoice(factorKey);
    onSubmit([
      {
        activity: picked?.label ?? factorKey,
        value,
        unit: picked?.inputUnit ?? "kg",
        candidateFactorKey: factorKey,
      },
    ]);
  }

  return (
    <Card as="section" elevation="raised" pad="lg">
      <form
        onSubmit={handleSubmit}
        aria-labelledby={`fallback-title-${reactId}`}
        className="space-y-6"
      >
        <div>
          <Badge tone="neutral" eyebrow>
            No AI needed
          </Badge>
          <h2
            id={`fallback-title-${reactId}`}
            className="mt-3 font-display text-h3 text-text"
          >
            Log without AI
          </h2>
          <p className="mt-2 max-w-[54ch] text-body-sm text-text-secondary">
            Pick what you did and enter a quantity. The same calculator computes
            your CO₂e from a published factor.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" id={catId}>
            {(controlProps) => (
              <select
                {...controlProps}
                value={category}
                onChange={(e) => handleCategory(e.target.value as Category)}
                className={inputClass()}
              >
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Activity" id={factorId}>
            {(controlProps) => (
              <select
                {...controlProps}
                value={factorKey}
                onChange={(e) => setFactorKey(e.target.value)}
                className={inputClass()}
              >
                {choices.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label={`Quantity${choice ? ` (${choice.inputUnit})` : ""}`}
            id={qtyId}
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                invalid={Boolean(error)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? qtyErrorId : undefined}
                className="numeric"
              />
            )}
          </Field>
        </div>

        {error && (
          <p
            id={qtyErrorId}
            role="alert"
            className="flex items-center gap-2 text-body-sm font-medium text-danger-fg"
          >
            <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" trailingIcon={<ArrowUpRight size={18} />}>
            Preview CO₂e
          </Button>
          {onCancel && (
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
