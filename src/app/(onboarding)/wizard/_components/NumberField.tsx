"use client";

import { useId } from "react";

/**
 * Labelled numeric input for the wizard: inputs have a visible <label> +
 * units in the accessible name, and the "I'm not sure" skip is a labelled control.
 *
 * - The unit is folded into the input's accessible name via aria-describedby +
 *   a visible unit suffix, so an SR reads "Electricity used, kilowatt-hours".
 * - The hint is a real <p> referenced by aria-describedby.
 * - "I'm not sure" is a labelled checkbox that disables the input (skippable
 *   step) without discarding the typed value.
 */
export function NumberField({
  id,
  label,
  unitLabel,
  unitSuffix,
  hint,
  value,
  onChange,
  unsure,
  onUnsureChange,
  min = 0,
  step = "any",
}: {
  id: string;
  label: string;
  /** Spoken unit, e.g. "kilowatt-hours" — appended to the accessible name. */
  unitLabel: string;
  /** Short visible unit suffix, e.g. "kWh". */
  unitSuffix: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  unsure: boolean;
  onUnsureChange: (unsure: boolean) => void;
  min?: number;
  step?: string;
}) {
  const reactId = useId();
  const inputId = `${id}-${reactId}`;
  const hintId = `${inputId}-hint`;
  const unitId = `${inputId}-unit`;
  const unsureId = `${inputId}-unsure`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-body-sm font-medium text-text">
        {label}
      </label>
      <p id={hintId} className="text-caption text-text-muted">
        {hint}
      </p>
      {/*
        Input + unit suffix share one rounded shell. The suffix carries the
        spoken unit (sr-only) folded into the input's accessible name via
        aria-describedby — restyled to the Input material (min-h ≥44px, the
        shared focus ring on the group) without changing the a11y wiring.
      */}
      <div
        className={[
          "flex items-stretch rounded-xs",
          "border bg-surface transition-colors duration-fast ease-out-quart",
          unsure
            ? "border-border bg-surface-sunken"
            : "border-border-strong hover:border-border-interactive",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-[--ring-offset]",
        ].join(" ")}
      >
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          disabled={unsure}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${hintId} ${unitId}`}
          className="min-h-[44px] w-full rounded-l-xs bg-transparent px-3.5 py-2.5 text-body text-text placeholder:text-text-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:text-text-disabled"
          placeholder="0"
        />
        <span
          id={unitId}
          className="inline-flex items-center rounded-r-xs border-l border-border bg-surface-sunken px-3.5 text-body-sm font-medium text-text-secondary"
        >
          <span className="sr-only">{unitLabel}</span>
          <span aria-hidden="true">{unitSuffix}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={unsureId}
          type="checkbox"
          checked={unsure}
          onChange={(e) => onUnsureChange(e.target.checked)}
          className="h-4 w-4 rounded-xs border-border-strong text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        />
        <label htmlFor={unsureId} className="text-caption text-text-secondary">
          I&rsquo;m not sure — skip this
        </label>
      </div>
    </div>
  );
}
