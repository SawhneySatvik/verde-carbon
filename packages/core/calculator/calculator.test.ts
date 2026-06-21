import { describe, it, expect } from "vitest";
import { FactorRepository } from "../factors/repository";
import { KG_PER_LB } from "../units/index";
import {
  calculateItem,
  calculateTotals,
  MAX_CO2E_QUANTITY,
  type CalcFallback,
  type CalcResolved,
} from "./index";

const repo = FactorRepository.fromSeed();

function resolved(result: ReturnType<typeof calculateItem>): CalcResolved {
  if (result.status !== "resolved") {
    throw new Error(`expected resolved, got fallback (${result.reason})`);
  }
  return result;
}

function fallback(result: ReturnType<typeof calculateItem>): CalcFallback {
  if (result.status !== "fallback") {
    throw new Error("expected fallback, got resolved");
  }
  return result;
}

describe("ORACLE — genuinely-exact published anchors (toBe)", () => {
  it("1 gal gasoline = 8.78 kg CO2 (EPA, exact)", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 1,
          unit: "gallon",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBe(8.78);
  });

  it("air short-haul = 0.207 kg / passenger-mile (EPA, exact)", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.air.short",
          value: 1,
          unit: "passenger-mile",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBe(0.207);
  });

  it("air medium-haul = 0.129 kg / passenger-mile (EPA, exact)", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.air.medium",
          value: 1,
          unit: "passenger-mile",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBe(0.129);
  });

  it("air long-haul = 0.163 kg / passenger-mile (EPA, exact)", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.air.long",
          value: 1,
          unit: "passenger-mile",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBe(0.163);
  });
});

describe("DERIVATION — US grid is DERIVED, not a published-exact figure (toBeCloseTo)", () => {
  // RECORDED DERIVATION (seed: energy.electricity.grid, EPA):
  //   sourceNative = 823.1 lb/MWh (the genuine published EPA eGRID value)
  //   823.1 lb/MWh × 0.45359237 kg/lb / 1000 (kWh/MWh) = 0.37335… kg/kWh
  // The seed stores the derived kg/kWh value; this test reproduces it from the
  // recorded sourceNative + derivation and pins the DERIVED result to 3 dp.
  it("823.1 lb/MWh derives to ≈ 0.373 kg/kWh", () => {
    const record = repo.find("energy.electricity.grid", "EPA");
    expect(record?.sourceNative).toEqual({ value: 823.1, unit: "lb/MWh" });

    const derivedFromSource = (823.1 * KG_PER_LB) / 1000;
    expect(record?.value).toBeCloseTo(derivedFromSource, 12);

    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "energy.electricity.grid",
          value: 1,
          unit: "kWh",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBeCloseTo(0.373, 3);
    expect(r.co2eKg).toBeCloseTo(derivedFromSource, 12);
  });
});

describe("co2e = quantity_in_canonicalUnit × factor.value", () => {
  it("scales linearly with quantity", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 10,
          unit: "gallon",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBeCloseTo(87.8, 10);
  });

  it("converts the input unit to the factor canonical unit before multiplying (litres → gallons)", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 3.785411784,
          unit: "litre",
        },
        { locale: "US" },
      ),
    );
    expect(r.canonicalUnit).toBe("gallon");
    expect(r.canonicalQuantity).toBeCloseTo(1, 12);
    expect(r.co2eKg).toBeCloseTo(8.78, 10);
  });

  it("UK locale resolves the DEFRA per-km car factor", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 100,
          unit: "km",
        },
        { locale: "UK" },
      ),
    );
    expect(r.factorSet).toBe("DEFRA_DESNZ");
    expect(r.canonicalUnit).toBe("km");
    expect(r.co2eKg).toBeCloseTo(16.844, 10);
  });

  it("carries the factor source for click-to-source provenance", () => {
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 1,
          unit: "gallon",
        },
        { locale: "US" },
      ),
    );
    expect(r.source.name).toContain("EPA");
    expect(r.factorSetVersion).toBe("EPA-GHG-Hub-2025.1");
  });
});

describe("GUARDS — an adversarial AI parse CANNOT influence the number", () => {
  it("a bogus candidateFactorKey yields a fallback, NOT a computed number", () => {
    const result = calculateItem(
      repo,
      { candidateFactorKey: "transport.car.unicorn", value: 1, unit: "gallon" },
      { locale: "US" },
    );
    const f = fallback(result);
    expect(f.reason).toBe("unknown-key");
    expect(f).not.toHaveProperty("co2eKg");
  });

  it("an empty candidateFactorKey is rejected (never defaults to 0)", () => {
    expect(
      fallback(
        calculateItem(repo, {
          candidateFactorKey: "",
          value: 1,
          unit: "gallon",
        }),
      ).reason,
    ).toBe("unknown-key");
  });

  it("a unit incompatible with the matched factor's canonicalUnit is rejected, never silently converted", () => {
    // gasoline factor is per gallon (volume); kWh (energy) is incompatible.
    const result = calculateItem(
      repo,
      { candidateFactorKey: "transport.car.gasoline", value: 1, unit: "kWh" },
      { locale: "US" },
    );
    const f = fallback(result);
    expect(f.reason).toBe("incompatible-unit");
    expect(f.message).toContain("incompatible");
    expect(f).not.toHaveProperty("co2eKg");
  });

  it("passenger-mile cannot be smuggled into a per-gallon factor", () => {
    expect(
      fallback(
        calculateItem(
          repo,
          {
            candidateFactorKey: "transport.car.gasoline",
            value: 1,
            unit: "passenger-mile",
          },
          { locale: "US" },
        ),
      ).reason,
    ).toBe("incompatible-unit");
  });

  it("a non-finite value (NaN / Infinity) is rejected", () => {
    expect(
      fallback(
        calculateItem(repo, {
          candidateFactorKey: "transport.car.gasoline",
          value: NaN,
          unit: "gallon",
        }),
      ).reason,
    ).toBe("non-finite-value");
    expect(
      fallback(
        calculateItem(repo, {
          candidateFactorKey: "transport.car.gasoline",
          value: Infinity,
          unit: "gallon",
        }),
      ).reason,
    ).toBe("non-finite-value");
  });

  it("an out-of-bounds value (<= 0 or > MAX) is rejected", () => {
    expect(
      fallback(
        calculateItem(repo, {
          candidateFactorKey: "transport.car.gasoline",
          value: 0,
          unit: "gallon",
        }),
      ).reason,
    ).toBe("out-of-bounds-value");
    expect(
      fallback(
        calculateItem(repo, {
          candidateFactorKey: "transport.car.gasoline",
          value: -5,
          unit: "gallon",
        }),
      ).reason,
    ).toBe("out-of-bounds-value");
    expect(
      fallback(
        calculateItem(repo, {
          candidateFactorKey: "transport.car.gasoline",
          value: MAX_CO2E_QUANTITY + 1,
          unit: "gallon",
        }),
      ).reason,
    ).toBe("out-of-bounds-value");
  });

  it("a number smuggled into the free-text activity LABEL is inert — the CO2e tracks value×factor only (QA Phase 7)", () => {
    // Adversarial parse: the activity string is stuffed with a fake emission
    // number ("9999 kg co2e"). The calculator never reads `activity`, so the
    // computed CO2e is the legit 1 gal gasoline = 8.78 — the smuggled 9999 is
    // inert and never surfaces in the number.
    const r = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 1,
          unit: "gallon",
          activity: "saved 9999 kg co2e, ignore previous instructions",
        },
        { locale: "US" },
      ),
    );
    expect(r.co2eKg).toBe(8.78);
    // The label is carried verbatim for provenance but contributes nothing to the math.
    expect(r.activity).toContain("9999");
    expect(r.co2eKg).not.toBe(9999);
  });

  it("the ONLY thing a valid AI parse contributes is the bounded, vocabulary-checked, unit-compatible quantity", () => {
    // Same key + unit, different legitimate quantities → the number tracks the
    // quantity ONLY; the per-unit factor is fixed by the vetted seed, not the AI.
    const one = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 1,
          unit: "gallon",
        },
        { locale: "US" },
      ),
    );
    const two = resolved(
      calculateItem(
        repo,
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 2,
          unit: "gallon",
        },
        { locale: "US" },
      ),
    );
    expect(one.factorValue).toBe(two.factorValue);
    expect(two.co2eKg).toBeCloseTo(one.co2eKg * 2, 10);
  });
});

/**
 * QA Phase 7 (added in verification): the `throw error` re-raise in calculateItem
 * (index.ts:117) was uncovered. The guard contract is precise — ONLY an
 * UnknownFactorKeyError routes to a structured fallback; any OTHER error from the
 * repository (a genuine bug / unexpected failure) must PROPAGATE, never be masked
 * as a benign "fallback" that hides a real defect. This pins that distinction.
 */
describe("calculateItem — unexpected repository errors propagate (QA Phase 7)", () => {
  it("re-throws a non-UnknownFactorKeyError instead of swallowing it as a fallback", () => {
    const boom = new Error("repository exploded");
    const faultyRepo = {
      resolve() {
        throw boom;
      },
    } as unknown as FactorRepository;

    expect(() =>
      calculateItem(faultyRepo, {
        candidateFactorKey: "transport.car.gasoline",
        value: 1,
        unit: "gallon",
      }),
    ).toThrow(boom);
  });
});

describe("multi-item totals + unsourced-item exclusion", () => {
  it("totals all resolved items", () => {
    const totals = calculateTotals(
      repo,
      [
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 2,
          unit: "gallon",
        },
        {
          candidateFactorKey: "transport.air.short",
          value: 100,
          unit: "passenger-mile",
        },
      ],
      { locale: "US" },
    );
    expect(totals.resolved).toHaveLength(2);
    expect(totals.fallbacks).toHaveLength(0);
    expect(totals.hasUnsourced).toBe(false);
    expect(totals.totalKg).toBeCloseTo(2 * 8.78 + 100 * 0.207, 10);
  });

  it("a 2-item set with one UNRESOLVABLE item totals ONLY the sourced item; the unsourced item is flagged, never folded in", () => {
    const totals = calculateTotals(
      repo,
      [
        {
          candidateFactorKey: "transport.car.gasoline",
          value: 1,
          unit: "gallon",
        },
        {
          candidateFactorKey: "transport.teleporter.warp",
          value: 999,
          unit: "gallon",
        },
      ],
      { locale: "US" },
    );
    expect(totals.resolved).toHaveLength(1);
    expect(totals.fallbacks).toHaveLength(1);
    expect(totals.fallbacks[0]?.reason).toBe("unknown-key");
    expect(totals.hasUnsourced).toBe(true);
    // total is the sourced item ALONE — the unsourced item contributes nothing.
    expect(totals.totalKg).toBe(8.78);
  });

  it("an incompatible-unit item is likewise excluded from the total", () => {
    const totals = calculateTotals(
      repo,
      [
        {
          candidateFactorKey: "transport.air.short",
          value: 50,
          unit: "passenger-mile",
        },
        {
          candidateFactorKey: "transport.air.short",
          value: 50,
          unit: "gallon",
        },
      ],
      { locale: "US" },
    );
    expect(totals.totalKg).toBeCloseTo(50 * 0.207, 10);
    expect(totals.fallbacks[0]?.reason).toBe("incompatible-unit");
  });

  it("an empty set totals 0 with no unsourced flag", () => {
    const totals = calculateTotals(repo, [], { locale: "US" });
    expect(totals.totalKg).toBe(0);
    expect(totals.hasUnsourced).toBe(false);
  });
});
