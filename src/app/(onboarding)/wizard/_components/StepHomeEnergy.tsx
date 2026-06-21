"use client";

import { NumberField } from "./NumberField";
import type { UnsureMap, WizardAnswers } from "./types";
import type { UnitSystem } from "@core/schemas";

/**
 * Wizard step 1 — Home energy. A labelled <fieldset>/<legend>
 * group. Units adapt to the chosen unit system (kWh always for electricity;
 * therms for gas in imperial, kWh in metric) and are folded into each input's
 * accessible name. Every field is skippable ("I'm not sure").
 */
export function StepHomeEnergy({
  unitSystem,
  answers,
  unsure,
  onAnswer,
  onUnsure,
}: {
  unitSystem: UnitSystem;
  answers: WizardAnswers;
  unsure: UnsureMap;
  onAnswer: (key: keyof WizardAnswers, value: string) => void;
  onUnsure: (key: string, value: boolean) => void;
}) {
  const gasMetric = unitSystem === "metric";
  return (
    <fieldset className="space-y-7">
      <legend className="font-display text-h2 text-balance text-text">
        Home energy
      </legend>
      <p className="max-w-[58ch] text-body text-text-secondary">
        Your home electricity and heating. A rough monthly figure is fine — you
        can refine it later.
      </p>

      <NumberField
        id="electricity"
        label="Electricity used per month"
        unitLabel="kilowatt-hours"
        unitSuffix="kWh"
        hint="Check a recent bill — a typical home uses 200–900 kWh a month."
        value={answers.electricityKwh}
        onChange={(v) => onAnswer("electricityKwh", v)}
        unsure={!!unsure.electricityKwh}
        onUnsureChange={(v) => onUnsure("electricityKwh", v)}
      />

      <NumberField
        id="gas"
        label="Natural gas used per month"
        unitLabel={gasMetric ? "kilowatt-hours" : "therms"}
        unitSuffix={gasMetric ? "kWh" : "therms"}
        hint={
          gasMetric
            ? "From your gas bill, in kWh. Leave blank if you don't use gas."
            : "From your gas bill, in therms. Leave blank if you don't use gas."
        }
        value={answers.gas}
        onChange={(v) => onAnswer("gas", v)}
        unsure={!!unsure.gas}
        onUnsureChange={(v) => onUnsure("gas", v)}
      />
    </fieldset>
  );
}
