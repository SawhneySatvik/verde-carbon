import type { FactorRecord, FactorSource, Unit } from "@core/schemas";
import { MAX_QUANTITY } from "@core/schemas";
import {
  FactorRepository,
  UnknownFactorKeyError,
  type ResolutionPreference,
} from "../factors/repository";
import {
  areCompatible,
  toCanonical,
  UnitConversionError,
} from "../units/index";

export const MAX_CO2E_QUANTITY = MAX_QUANTITY;

export type CalcRejectionReason =
  | "unknown-key"
  | "incompatible-unit"
  | "non-finite-value"
  | "out-of-bounds-value";

export interface CalcItemInput {
  candidateFactorKey: unknown;
  value: number;
  unit: Unit;
  activity?: string;
}

export interface CalcResolved {
  status: "resolved";
  candidateFactorKey: string;
  activity?: string;
  inputValue: number;
  inputUnit: Unit;
  canonicalUnit: Unit;
  canonicalQuantity: number;
  factorValue: number;
  factorSet: FactorRecord["factorSet"];
  factorSetVersion: string;
  category: FactorRecord["category"];
  source: FactorSource;
  co2eKg: number;
}

export interface CalcFallback {
  status: "fallback";
  candidateFactorKey: unknown;
  activity?: string;
  inputValue: number;
  inputUnit: Unit;
  reason: CalcRejectionReason;
  message: string;
}

export type CalcItemResult = CalcResolved | CalcFallback;

export interface CalcTotals {
  items: readonly CalcItemResult[];
  resolved: readonly CalcResolved[];
  fallbacks: readonly CalcFallback[];
  totalKg: number;
  hasUnsourced: boolean;
}

function isBoundedFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_CO2E_QUANTITY;
}

/**
 * Pure, I/O-free CO2e for a single (vocabulary-checked, bounded, unit-compatible)
 * quantity. The AI parse can only supply candidateFactorKey/value/unit; every one
 * is guarded here, so an adversarial parse can never INFLUENCE the number beyond
 * the bounded quantity it legitimately supplies (ADR-001). Any guard failure
 * returns a structured `fallback`, never a computed number.
 */
export function calculateItem(
  repository: FactorRepository,
  input: CalcItemInput,
  preference: ResolutionPreference = {},
): CalcItemResult {
  const base = {
    candidateFactorKey: input.candidateFactorKey,
    activity: input.activity,
    inputValue: input.value,
    inputUnit: input.unit,
  };

  if (!Number.isFinite(input.value)) {
    return {
      status: "fallback",
      ...base,
      reason: "non-finite-value",
      message: `Quantity ${String(input.value)} is not a finite number.`,
    };
  }
  if (!isBoundedFinite(input.value)) {
    return {
      status: "fallback",
      ...base,
      reason: "out-of-bounds-value",
      message: `Quantity ${input.value} is outside the allowed range (0, ${MAX_CO2E_QUANTITY}].`,
    };
  }

  let factor: FactorRecord;
  try {
    factor = repository.resolve(input.candidateFactorKey, preference);
  } catch (error) {
    if (error instanceof UnknownFactorKeyError) {
      return {
        status: "fallback",
        ...base,
        reason: "unknown-key",
        message: error.message,
      };
    }
    throw error;
  }

  if (!areCompatible(input.unit, factor.canonicalUnit)) {
    return {
      status: "fallback",
      ...base,
      reason: "incompatible-unit",
      message: new UnitConversionError(input.unit, factor.canonicalUnit)
        .message,
    };
  }

  const canonicalQuantity = toCanonical(
    input.value,
    input.unit,
    factor.canonicalUnit,
  );
  const co2eKg = canonicalQuantity * factor.value;

  return {
    status: "resolved",
    candidateFactorKey: factor.key,
    activity: input.activity,
    inputValue: input.value,
    inputUnit: input.unit,
    canonicalUnit: factor.canonicalUnit,
    canonicalQuantity,
    factorValue: factor.value,
    factorSet: factor.factorSet,
    factorSetVersion: factor.factorSetVersion,
    category: factor.category,
    source: factor.source,
    co2eKg,
  };
}

/**
 * Total a multi-item set. Only `resolved` items are folded into `totalKg`; any
 * `fallback` (unknown key / incompatible unit / out-of-bounds value) is flagged
 * and EXCLUDED from the total — never silently summed as zero or a guess.
 */
export function calculateTotals(
  repository: FactorRepository,
  inputs: readonly CalcItemInput[],
  preference: ResolutionPreference = {},
): CalcTotals {
  const items = inputs.map((input) =>
    calculateItem(repository, input, preference),
  );
  const resolved = items.filter(
    (r): r is CalcResolved => r.status === "resolved",
  );
  const fallbacks = items.filter(
    (r): r is CalcFallback => r.status === "fallback",
  );
  const totalKg = resolved.reduce((sum, r) => sum + r.co2eKg, 0);
  return {
    items,
    resolved,
    fallbacks,
    totalKg,
    hasUnsourced: fallbacks.length > 0,
  };
}
