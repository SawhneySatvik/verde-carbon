import type { Unit } from "@core/schemas";

export const DISPLAY_PRECISION = 2;

export class UnitConversionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`No conversion from "${from}" to "${to}": incompatible dimensions.`);
    this.name = "UnitConversionError";
  }
}

type Dimension =
  | "distance"
  | "passenger-distance"
  | "volume"
  | "energy"
  | "mass"
  | "count";

const DIMENSION_OF: Record<Unit, Dimension> = {
  mile: "distance",
  km: "distance",
  "passenger-mile": "passenger-distance",
  "passenger-km": "passenger-distance",
  gallon: "volume",
  litre: "volume",
  kWh: "energy",
  MWh: "energy",
  kg: "mass",
  lb: "mass",
  meal: "count",
  night: "count",
  therm: "energy",
};

const MILES_PER_KM = 0.621371192;
const KM_PER_MILE = 1.609344;
const LITRES_PER_GALLON = 3.785411784;
const KG_PER_LB = 0.45359237;
const KWH_PER_MWH = 1000;
const KWH_PER_THERM = 29.307107017;

const TO_BASE: Partial<Record<Unit, number>> = {
  km: 1,
  mile: KM_PER_MILE,
  "passenger-km": 1,
  "passenger-mile": KM_PER_MILE,
  litre: 1,
  gallon: LITRES_PER_GALLON,
  kWh: 1,
  MWh: KWH_PER_MWH,
  therm: KWH_PER_THERM,
  kg: 1,
  lb: KG_PER_LB,
  meal: 1,
  night: 1,
};

export function areCompatible(from: Unit, to: Unit): boolean {
  return DIMENSION_OF[from] === DIMENSION_OF[to];
}

export const ROUND_TRIP_EPSILON = 1e-9;

export function convert(value: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `convert() requires a finite value, received ${value}.`,
    );
  }
  if (from === to) {
    return value;
  }
  if (!areCompatible(from, to)) {
    throw new UnitConversionError(from, to);
  }
  const fromFactor = TO_BASE[from];
  const toFactor = TO_BASE[to];
  if (fromFactor === undefined || toFactor === undefined) {
    throw new UnitConversionError(from, to);
  }
  return (value * fromFactor) / toFactor;
}

export function isLosslessRoundTrip(
  original: number,
  roundTripped: number,
  epsilon = ROUND_TRIP_EPSILON,
): boolean {
  if (original === roundTripped) {
    return true;
  }
  if (original === 0) {
    return Math.abs(roundTripped) <= epsilon;
  }
  return Math.abs(roundTripped - original) / Math.abs(original) <= epsilon;
}

export function toCanonical(
  value: number,
  from: Unit,
  canonicalUnit: Unit,
): number {
  return convert(value, from, canonicalUnit);
}

export function roundForDisplay(
  value: number,
  precision = DISPLAY_PRECISION,
): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `roundForDisplay() requires a finite value, received ${value}.`,
    );
  }
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export {
  MILES_PER_KM,
  KM_PER_MILE,
  LITRES_PER_GALLON,
  KG_PER_LB,
  KWH_PER_MWH,
  KWH_PER_THERM,
};
