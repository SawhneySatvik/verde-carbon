import { describe, it, expect } from "vitest";
import {
  convert,
  toCanonical,
  areCompatible,
  roundForDisplay,
  isLosslessRoundTrip,
  UnitConversionError,
  DISPLAY_PRECISION,
  ROUND_TRIP_EPSILON,
  KM_PER_MILE,
  LITRES_PER_GALLON,
  KG_PER_LB,
} from "./index";
import { UNIT_VOCABULARY, type Unit } from "@core/schemas";

describe("unit conversions — exact factors", () => {
  it("1 mile = 1.609344 km (NIST exact)", () => {
    expect(convert(1, "mile", "km")).toBe(KM_PER_MILE);
    expect(convert(1, "mile", "km")).toBe(1.609344);
  });

  it("1 gallon = 3.785411784 litres (US exact)", () => {
    expect(convert(1, "gallon", "litre")).toBe(LITRES_PER_GALLON);
    expect(convert(1, "gallon", "litre")).toBe(3.785411784);
  });

  it("1 lb = 0.45359237 kg (international exact)", () => {
    expect(convert(1, "lb", "kg")).toBe(KG_PER_LB);
    expect(convert(1, "lb", "kg")).toBe(0.45359237);
  });

  it("1 MWh = 1000 kWh", () => {
    expect(convert(1, "MWh", "kWh")).toBe(1000);
  });

  it("identity conversion returns the same value", () => {
    expect(convert(42.5, "kWh", "kWh")).toBe(42.5);
  });
});

describe("round-trip losslessness", () => {
  // Policy: a metric<->imperial round trip recovers the original to full IEEE-754
  // round-trip precision (relative error <= ROUND_TRIP_EPSILON). Bit-exact `toBe`
  // is not achievable for irrational-ratio factors (e.g. 0.45359237), so the
  // contract is "no meaningful loss" — asserted via isLosslessRoundTrip. The
  // canonical single conversions below are still pinned exactly with `toBe`.
  const roundTripPairs: ReadonlyArray<readonly [Unit, Unit]> = [
    ["mile", "km"],
    ["km", "mile"],
    ["gallon", "litre"],
    ["litre", "gallon"],
    ["kWh", "MWh"],
    ["MWh", "kWh"],
    ["kg", "lb"],
    ["lb", "kg"],
    ["passenger-mile", "passenger-km"],
    ["passenger-km", "passenger-mile"],
  ];

  const samples = [
    1, 0.5, 12.7, 823.1, 20, 1_000_000, 0.0001, 3.14159, 99999.99,
  ];

  for (const [from, to] of roundTripPairs) {
    it(`${from} -> ${to} -> ${from} is lossless within policy`, () => {
      for (const v of samples) {
        const there = convert(v, from, to);
        const back = convert(there, to, from);
        expect(isLosslessRoundTrip(v, back)).toBe(true);
        expect(back).toBeCloseTo(v, 6);
      }
    });
  }

  it("integer-ratio factors (MWh<->kWh) round-trip bit-exactly", () => {
    for (const v of samples) {
      expect(convert(convert(v, "MWh", "kWh"), "kWh", "MWh")).toBe(v);
    }
  });

  it("ROUND_TRIP_EPSILON is a tight relative bound", () => {
    expect(ROUND_TRIP_EPSILON).toBeLessThanOrEqual(1e-9);
    expect(isLosslessRoundTrip(823.1, 823.1000000000001)).toBe(true);
    expect(isLosslessRoundTrip(823.1, 824)).toBe(false);
  });

  // QA Phase 7 (added in verification): the `original === 0` branch of
  // isLosslessRoundTrip (units/index.ts:96-97) was uncovered. Relative error is
  // undefined at zero, so the function switches to an ABSOLUTE epsilon there.
  // A 0-quantity round trip is a legitimate edge (e.g. a zeroed input field).
  it("treats a zero original with an ABSOLUTE epsilon (not relative)", () => {
    expect(isLosslessRoundTrip(0, 0)).toBe(true); // exact-equality fast path
    expect(isLosslessRoundTrip(0, ROUND_TRIP_EPSILON)).toBe(true); // within abs eps
    expect(isLosslessRoundTrip(0, ROUND_TRIP_EPSILON / 2)).toBe(true);
    expect(isLosslessRoundTrip(0, 1e-3)).toBe(false); // beyond abs eps → loss
    expect(isLosslessRoundTrip(0, -ROUND_TRIP_EPSILON)).toBe(true); // sign-agnostic
  });
});

describe("dimension compatibility / rejection", () => {
  it("areCompatible groups by physical dimension", () => {
    expect(areCompatible("mile", "km")).toBe(true);
    expect(areCompatible("gallon", "litre")).toBe(true);
    expect(areCompatible("kg", "lb")).toBe(true);
    expect(areCompatible("mile", "litre")).toBe(false);
    expect(areCompatible("kWh", "kg")).toBe(false);
  });

  it("throws UnitConversionError across incompatible dimensions", () => {
    expect(() => convert(1, "mile", "litre")).toThrow(UnitConversionError);
    expect(() => convert(1, "kWh", "kg")).toThrow(UnitConversionError);
    expect(() => convert(1, "passenger-mile", "mile")).toThrow(
      UnitConversionError,
    );
  });

  it("throws on a non-finite input value", () => {
    expect(() => convert(NaN, "mile", "km")).toThrow(TypeError);
    expect(() => convert(Infinity, "mile", "km")).toThrow(TypeError);
  });

  it("every unit in the vocabulary has a declared dimension", () => {
    for (const u of UNIT_VOCABULARY) {
      expect(() => areCompatible(u, u)).not.toThrow();
      expect(areCompatible(u, u)).toBe(true);
    }
  });
});

describe("toCanonical convenience wrapper", () => {
  it("converts a quantity to the factor canonical unit", () => {
    expect(toCanonical(2, "MWh", "kWh")).toBe(2000);
    expect(toCanonical(1, "mile", "km")).toBe(KM_PER_MILE);
  });
});

describe("display-precision policy", () => {
  it(`defaults to ${DISPLAY_PRECISION} decimal places`, () => {
    expect(roundForDisplay(0.37335184)).toBe(0.37);
    expect(roundForDisplay(8.781234)).toBe(8.78);
  });

  it("honors a caller-supplied precision", () => {
    expect(roundForDisplay(0.37335184, 3)).toBe(0.373);
    expect(roundForDisplay(0.37335184, 5)).toBe(0.37335);
  });

  it("rounds half away from zero stably", () => {
    expect(roundForDisplay(1.005, 2)).toBe(1.01);
  });

  it("throws on non-finite display input", () => {
    expect(() => roundForDisplay(NaN)).toThrow(TypeError);
  });
});
