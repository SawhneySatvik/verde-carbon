"use client";

import { NumberField } from "./NumberField";
import type { UnsureMap, WizardAnswers } from "./types";

/**
 * Wizard step 3 — Diet. Counts of meals per month by type;
 * the unit is always "meals" regardless of unit system (count dimension).
 */
export function StepDiet({
  answers,
  unsure,
  onAnswer,
  onUnsure,
}: {
  answers: WizardAnswers;
  unsure: UnsureMap;
  onAnswer: (key: keyof WizardAnswers, value: string) => void;
  onUnsure: (key: string, value: boolean) => void;
}) {
  return (
    <fieldset className="space-y-7">
      <legend className="font-display text-h2 text-balance text-text">
        Diet
      </legend>
      <p className="max-w-[58ch] text-body text-text-secondary">
        Roughly how many meals of each type you eat in a month.
      </p>

      <NumberField
        id="beef"
        label="Beef / red-meat meals per month"
        unitLabel="meals"
        unitSuffix="meals"
        hint="Meals where beef or lamb is the main protein."
        value={answers.beefMeals}
        onChange={(v) => onAnswer("beefMeals", v)}
        unsure={!!unsure.beefMeals}
        onUnsureChange={(v) => onUnsure("beefMeals", v)}
        step="1"
      />

      <NumberField
        id="chicken"
        label="Chicken / poultry meals per month"
        unitLabel="meals"
        unitSuffix="meals"
        hint="Meals where chicken, turkey or pork is the main protein."
        value={answers.chickenMeals}
        onChange={(v) => onAnswer("chickenMeals", v)}
        unsure={!!unsure.chickenMeals}
        onUnsureChange={(v) => onUnsure("chickenMeals", v)}
        step="1"
      />

      <NumberField
        id="veg"
        label="Vegetarian / plant-based meals per month"
        unitLabel="meals"
        unitSuffix="meals"
        hint="Meals with no meat or fish."
        value={answers.vegMeals}
        onChange={(v) => onAnswer("vegMeals", v)}
        unsure={!!unsure.vegMeals}
        onUnsureChange={(v) => onUnsure("vegMeals", v)}
        step="1"
      />
    </fieldset>
  );
}
