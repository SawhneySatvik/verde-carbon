import type { Category, Unit } from "@core/schemas";

/**
 * Client-safe, human-readable catalog of the seeded factors, used by the
 * candidate-factor picker (Parse Confirmation) and the structured fallback form.
 * Keys MUST match the seed vocabulary so the calculator resolves them; the
 * `inputUnit` is the unit we ask the user for (the preview module converts to
 * canonical internally). This is presentation metadata only — no factor VALUES
 * live here; numbers always come from the calculator.
 */
export interface FactorChoice {
  key: string;
  category: Category;
  label: string;
  /** Unit the user enters; chosen to be compatible with the factor. */
  inputUnit: Unit;
  /** Spoken unit for accessible names. */
  unitLabel: string;
}

export const FACTOR_CHOICES: readonly FactorChoice[] = [
  {
    key: "energy.electricity.grid",
    category: "energy",
    label: "Grid electricity",
    inputUnit: "kWh",
    unitLabel: "kilowatt-hours",
  },
  {
    key: "energy.naturalgas.home",
    category: "energy",
    label: "Home natural gas",
    inputUnit: "kWh",
    unitLabel: "kilowatt-hours",
  },
  {
    key: "transport.car.gasoline",
    category: "transport",
    label: "Car — petrol/gasoline",
    inputUnit: "km",
    unitLabel: "kilometres",
  },
  {
    key: "transport.car.diesel",
    category: "transport",
    label: "Car — diesel",
    inputUnit: "km",
    unitLabel: "kilometres",
  },
  {
    key: "transport.air.short",
    category: "transport",
    label: "Flight — short haul",
    inputUnit: "passenger-km",
    unitLabel: "passenger-kilometres",
  },
  {
    key: "transport.air.medium",
    category: "transport",
    label: "Flight — medium haul",
    inputUnit: "passenger-km",
    unitLabel: "passenger-kilometres",
  },
  {
    key: "transport.air.long",
    category: "transport",
    label: "Flight — long haul",
    inputUnit: "passenger-km",
    unitLabel: "passenger-kilometres",
  },
  {
    key: "diet.meal.beef",
    category: "diet",
    label: "Beef / red-meat meal",
    inputUnit: "meal",
    unitLabel: "meals",
  },
  {
    key: "diet.meal.chicken",
    category: "diet",
    label: "Chicken / poultry meal",
    inputUnit: "meal",
    unitLabel: "meals",
  },
  {
    key: "diet.meal.vegetarian",
    category: "diet",
    label: "Vegetarian meal",
    inputUnit: "meal",
    unitLabel: "meals",
  },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  energy: "Home energy",
  transport: "Transport",
  diet: "Diet",
};

export function choicesForCategory(
  category: Category,
): readonly FactorChoice[] {
  return FACTOR_CHOICES.filter((c) => c.category === category);
}

export function isKnownChoiceKey(key: unknown): key is string {
  return typeof key === "string" && FACTOR_CHOICES.some((c) => c.key === key);
}

export function findChoice(key: string): FactorChoice | undefined {
  return FACTOR_CHOICES.find((c) => c.key === key);
}
