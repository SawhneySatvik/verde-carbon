import type { Locale, Unit, UnitSystem } from "@core/schemas";

/**
 * Wizard state shared across the four steps. The wizard holds RAW user answers
 * keyed by a stable question id; unit-system switches convert the stored numeric
 * answers in place (round-trip-safe) without losing data. No CO2e is stored here — the Review step derives every
 * number from the calculator/preview module.
 */

export type UnsureMap = Record<string, boolean>;

export interface WizardAnswers {
  // Home energy
  electricityKwh: string;
  gas: string; // therms (imperial) | kWh (metric)
  // Transport
  carDistance: string; // miles (imperial) | km (metric)
  flightDistance: string; // passenger-miles (imperial) | passenger-km (metric)
  // Diet
  beefMeals: string;
  chickenMeals: string;
  vegMeals: string;
}

export interface WizardState {
  locale: Locale;
  unitSystem: UnitSystem;
  answers: WizardAnswers;
  unsure: UnsureMap;
}

export const EMPTY_ANSWERS: WizardAnswers = {
  electricityKwh: "",
  gas: "",
  carDistance: "",
  flightDistance: "",
  beefMeals: "",
  chickenMeals: "",
  vegMeals: "",
};

/** A calculator input row produced from one wizard answer. */
export interface WizardItemInput {
  activity: string;
  candidateFactorKey: string;
  value: number;
  unit: Unit;
}

export const STEP_TITLES = [
  "Home energy",
  "Transport",
  "Diet",
  "Review",
] as const;
