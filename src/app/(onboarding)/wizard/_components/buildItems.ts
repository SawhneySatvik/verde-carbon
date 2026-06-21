import { convert } from "@core/units";
import type { Unit, UnitSystem } from "@core/schemas";
import type { UnsureMap, WizardAnswers, WizardItemInput } from "./types";

/**
 * Maps wizard answers → calculator inputs: the Review breakdown
 * is computed by the calculator, never invented. One answer becomes at most one
 * input; blank or "I'm not sure" answers are omitted (skippable, no guessing).
 *
 * Units track the chosen unit system so the calculator receives the unit the
 * user actually entered; the preview module converts to the factor's canonical
 * unit internally.
 */

interface FieldSpec {
  key: keyof WizardAnswers;
  activity: string;
  candidateFactorKey: string;
  unit: (system: UnitSystem) => Unit;
}

const FIELDS: readonly FieldSpec[] = [
  {
    key: "electricityKwh",
    activity: "Home electricity",
    candidateFactorKey: "energy.electricity.grid",
    unit: () => "kWh",
  },
  {
    key: "gas",
    activity: "Natural gas heating",
    candidateFactorKey: "energy.naturalgas.home",
    unit: (s) => (s === "metric" ? "kWh" : "therm"),
  },
  {
    // Imperial → fuel (gallons) against EPA's per-gallon factor; metric →
    // distance (km) against DEFRA's per-km factor. Both resolve cleanly.
    key: "carDistance",
    activity: "Car travel",
    candidateFactorKey: "transport.car.gasoline",
    unit: (s) => (s === "metric" ? "km" : "gallon"),
  },
  {
    key: "flightDistance",
    activity: "Air travel",
    candidateFactorKey: "transport.air.medium",
    unit: (s) => (s === "metric" ? "passenger-km" : "passenger-mile"),
  },
  {
    key: "beefMeals",
    activity: "Beef / red-meat meals",
    candidateFactorKey: "diet.meal.beef",
    unit: () => "meal",
  },
  {
    key: "chickenMeals",
    activity: "Chicken / poultry meals",
    candidateFactorKey: "diet.meal.chicken",
    unit: () => "meal",
  },
  {
    key: "vegMeals",
    activity: "Vegetarian meals",
    candidateFactorKey: "diet.meal.vegetarian",
    unit: () => "meal",
  },
];

export function buildWizardItems(
  answers: WizardAnswers,
  unsure: UnsureMap,
  unitSystem: UnitSystem,
): WizardItemInput[] {
  const items: WizardItemInput[] = [];
  for (const field of FIELDS) {
    if (unsure[field.key]) {
      continue;
    }
    const raw = answers[field.key].trim();
    if (raw === "") {
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    items.push({
      activity: field.activity,
      candidateFactorKey: field.candidateFactorKey,
      value,
      unit: field.unit(unitSystem),
    });
  }
  return items;
}

/**
 * Distance/energy fields whose value converts on a unit-system flip.
 *
 * Car is intentionally NOT here: its question CHANGES between fuel (gallons,
 * imperial) and distance (km, metric) — different quantities, not the same value
 * in different units — so it is never silently converted. Gas (therm↔kWh, both
 * energy) and air travel (passenger-mile↔passenger-km, both distance) ARE
 * round-trip-safe and convert in place.
 */
const CONVERTIBLE: ReadonlyArray<{
  key: keyof WizardAnswers;
  metricUnit: Unit;
  imperialUnit: Unit;
}> = [
  { key: "gas", metricUnit: "kWh", imperialUnit: "therm" },
  {
    key: "flightDistance",
    metricUnit: "passenger-km",
    imperialUnit: "passenger-mile",
  },
];

/**
 * Convert the stored answers in place when the unit system flips
 * (round-trip-safe, non-destructive). Returns a new
 * answers object plus the set of changed field keys (so the caller can announce
 * the conversion). Diet counts and electricity (always kWh) are unchanged.
 */
export function convertAnswers(
  answers: WizardAnswers,
  from: UnitSystem,
  to: UnitSystem,
): { answers: WizardAnswers; changed: Array<keyof WizardAnswers> } {
  if (from === to) {
    return { answers, changed: [] };
  }
  const next: WizardAnswers = { ...answers };
  const changed: Array<keyof WizardAnswers> = [];
  for (const spec of CONVERTIBLE) {
    const raw = answers[spec.key].trim();
    if (raw === "") {
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      continue;
    }
    const fromUnit = from === "metric" ? spec.metricUnit : spec.imperialUnit;
    const toUnit = to === "metric" ? spec.metricUnit : spec.imperialUnit;
    const converted = convert(value, fromUnit, toUnit);
    // Keep a clean display precision; the stored string is what the user sees.
    next[spec.key] = String(Math.round(converted * 100) / 100);
    changed.push(spec.key);
  }
  return { answers: next, changed };
}
