"use client";

import type { RefObject } from "react";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { Field, Input } from "../../../_components/Field";
import { AlertTriangle } from "../../../_components/icons";

/**
 * GoalForm — presentational target-%/period/baseline form. All state, refs,
 * validation and submit/clear logic live in the parent and arrive via props.
 */

type Period = "weekly" | "monthly" | "yearly";

const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function GoalForm({
  hasGoal,
  targetId,
  baselineId,
  targetPct,
  period,
  baselineKg,
  fieldError,
  saving,
  targetRef,
  baselineRef,
  onTargetPctChange,
  onPeriodChange,
  onBaselineKgChange,
  onSave,
  onClear,
}: {
  hasGoal: boolean;
  targetId: string;
  baselineId: string;
  targetPct: string;
  period: Period;
  baselineKg: string;
  fieldError: string | null;
  saving: boolean;
  targetRef: RefObject<HTMLInputElement | null>;
  baselineRef: RefObject<HTMLInputElement | null>;
  onTargetPctChange: (value: string) => void;
  onPeriodChange: (value: Period) => void;
  onBaselineKgChange: (value: string) => void;
  onSave: (e: React.FormEvent) => void;
  onClear: () => void;
}) {
  return (
    <Card as="div" pad="lg">
      <form onSubmit={onSave}>
        <div className="space-y-6">
          <Field
            id={targetId}
            label="Reduction target (percent vs baseline)"
            error={
              fieldError ? (
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle
                    size={15}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  {fieldError}
                </span>
              ) : undefined
            }
          >
            {(controlProps) => (
              <div className="flex items-center gap-2.5">
                <Input
                  {...controlProps}
                  ref={targetRef}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step="1"
                  value={targetPct}
                  onChange={(e) => onTargetPctChange(e.target.value)}
                  invalid={Boolean(fieldError)}
                  className="numeric w-28"
                />
                <span className="text-body text-text-secondary">
                  % reduction
                </span>
              </div>
            )}
          </Field>

          <fieldset>
            <legend className="text-body-sm font-medium text-text">
              Period
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {PERIODS.map((p) => (
                <label
                  key={p.value}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-pill border border-border px-4 py-2.5 text-body-sm font-medium text-text-secondary transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text has-[:checked]:border-brand has-[:checked]:bg-surface-brand-subtle has-[:checked]:text-brand-fg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[--ring-offset]"
                >
                  <input
                    type="radio"
                    name="period"
                    value={p.value}
                    checked={period === p.value}
                    onChange={() => onPeriodChange(p.value)}
                    className="h-4 w-4 border-border-interactive text-brand focus-visible:outline-none"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            id={baselineId}
            label="Baseline footprint (kg CO₂e)"
            hint="Your starting point. Progress is measured against this."
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                ref={baselineRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={baselineKg}
                onChange={(e) => onBaselineKgChange(e.target.value)}
                className="numeric w-44"
              />
            )}
          </Field>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <Button type="submit" loading={saving}>
            {hasGoal ? "Update goal" : "Save goal"}
          </Button>
          {hasGoal && (
            <Button
              type="button"
              variant="secondary"
              onClick={onClear}
              disabled={saving}
              className="text-danger-fg"
            >
              Clear goal
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
