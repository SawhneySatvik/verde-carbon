import { describe, it, expect } from "vitest";
import type { FactorRecord } from "@core/schemas";
import {
  FactorRepository,
  LOCALE_DEFAULTS,
  UnknownFactorKeyError,
} from "./repository";
import { defraDesnzFactorSet, epaFactorSet } from "./seed/index";

const repo = FactorRepository.fromSeed();

describe("FactorRepository — vocabulary check (reject unknown keys)", () => {
  it("isKnownKey is true for a seeded key", () => {
    expect(repo.isKnownKey("transport.car.gasoline")).toBe(true);
    expect(repo.isKnownKey("energy.electricity.grid")).toBe(true);
  });

  it("isKnownKey is false for an unknown key", () => {
    expect(repo.isKnownKey("transport.car.unicorn")).toBe(false);
  });

  it("isKnownKey is false for empty / non-string keys", () => {
    expect(repo.isKnownKey("")).toBe(false);
    expect(repo.isKnownKey(undefined)).toBe(false);
    expect(repo.isKnownKey(null)).toBe(false);
    expect(repo.isKnownKey(42)).toBe(false);
  });

  it("assertKnownKey throws UnknownFactorKeyError for an unknown key", () => {
    expect(() => repo.assertKnownKey("nope.not.real")).toThrow(
      UnknownFactorKeyError,
    );
  });

  it("assertKnownKey throws for an empty key", () => {
    expect(() => repo.assertKnownKey("")).toThrow(UnknownFactorKeyError);
  });

  it("assertKnownKey passes for a known key", () => {
    expect(() => repo.assertKnownKey("diet.meal.beef")).not.toThrow();
  });

  it("resolve never coerces an unknown key to a zero/default factor", () => {
    expect(() => repo.resolve("totally.unknown", { locale: "US" })).toThrow(
      UnknownFactorKeyError,
    );
  });
});

describe("FactorRepository — locale default map", () => {
  it("UK -> DEFRA_DESNZ + metric", () => {
    expect(LOCALE_DEFAULTS.UK).toEqual({
      factorSet: "DEFRA_DESNZ",
      unitSystem: "metric",
    });
    expect(repo.defaultsForLocale("UK")).toEqual({
      factorSet: "DEFRA_DESNZ",
      unitSystem: "metric",
    });
  });

  it("US -> EPA + imperial", () => {
    expect(LOCALE_DEFAULTS.US).toEqual({
      factorSet: "EPA",
      unitSystem: "imperial",
    });
    expect(repo.defaultsForLocale("US")).toEqual({
      factorSet: "EPA",
      unitSystem: "imperial",
    });
  });
});

describe("FactorRepository — resolution by locale + override", () => {
  it("resolves a US-locale gasoline factor to the EPA record (8.78 / gallon)", () => {
    const record = repo.resolve("transport.car.gasoline", { locale: "US" });
    expect(record.factorSet).toBe("EPA");
    expect(record.value).toBe(8.78);
    expect(record.canonicalUnit).toBe("gallon");
  });

  it("resolves a UK-locale gasoline factor to the DEFRA record (per km)", () => {
    const record = repo.resolve("transport.car.gasoline", { locale: "UK" });
    expect(record.factorSet).toBe("DEFRA_DESNZ");
    expect(record.canonicalUnit).toBe("km");
  });

  it("an explicit factorSet override beats the locale default", () => {
    const record = repo.resolve("transport.car.gasoline", {
      locale: "UK",
      factorSet: "EPA",
    });
    expect(record.factorSet).toBe("EPA");
    expect(record.value).toBe(8.78);
  });

  it("resolveFactorSet defaults to US/EPA when no preference is given", () => {
    expect(repo.resolveFactorSet({})).toBe("EPA");
  });

  it("find returns the exact record for a (key, factorSet) pair", () => {
    const epa = repo.find("energy.electricity.grid", "EPA");
    expect(epa?.sourceNative).toEqual({ value: 823.1, unit: "lb/MWh" });
    const defra = repo.find("energy.electricity.grid", "DEFRA_DESNZ");
    expect(defra?.canonicalUnit).toBe("kWh");
    expect(defra?.assertionStyle).toBe("toBe");
  });

  it("find returns undefined for an unknown (key, factorSet) pair", () => {
    expect(repo.find("nope", "EPA")).toBeUndefined();
  });
});

describe("FactorRepository — construction guards", () => {
  it("knownKeys exposes the vocabulary for the calculator + handlers", () => {
    const keys = repo.knownKeys();
    expect(keys).toContain("transport.car.gasoline");
    expect(keys).toContain("diet.meal.vegetarian");
  });

  it("rejects duplicate (key, factorSet) records at construction", () => {
    const dup = repo.records()[0];
    expect(() => new FactorRepository([dup, dup])).toThrow();
  });
});

/**
 * QA Phase 7 (added in verification): the cross-factor-set FALLBACK branch of
 * `resolve()` (repository.ts:104-108). The shipped EPA+DEFRA seed defines the
 * SAME key vocabulary in both sets, so this safety net is never exercised by the
 * real seed — but it is a real behavioural branch: a key that exists in ONLY one
 * factor set, requested under the OTHER set's preference, must fall back to the
 * available record rather than throwing or coercing to 0. This guards the
 * "global by default, extensible factor table" promise (an asymmetric set that
 * adds a key the other set lacks must still resolve, not error).
 */
describe("FactorRepository — cross-factor-set resolution fallback (QA Phase 7)", () => {
  const epaOnly = repo.find("transport.car.gasoline", "EPA")!;
  // A key that lives ONLY in EPA (no DEFRA_DESNZ counterpart).
  const asymmetric: FactorRecord = { ...epaOnly, key: "epa.only.special" };
  const asymmetricRepo = new FactorRepository([asymmetric]);

  it("falls back to the only available record when the preferred set lacks the key", () => {
    // Prefer DEFRA_DESNZ, but the key exists only under EPA → fall back, don't throw.
    const record = asymmetricRepo.resolve("epa.only.special", {
      factorSet: "DEFRA_DESNZ",
    });
    expect(record.key).toBe("epa.only.special");
    expect(record.factorSet).toBe("EPA");
    expect(record.value).toBe(8.78);
  });

  it("falls back for a UK-locale preference too (never coerces to 0)", () => {
    const record = asymmetricRepo.resolve("epa.only.special", { locale: "UK" });
    expect(record.factorSet).toBe("EPA");
    expect(record.value).toBeGreaterThan(0);
  });

  it("still throws UnknownFactorKeyError for a key in NO set", () => {
    expect(() =>
      asymmetricRepo.resolve("not.in.any.set", { factorSet: "EPA" }),
    ).toThrow(UnknownFactorKeyError);
  });
});

/**
 * QA Phase 7: `fromCollections` static constructor (repository.ts:62-65) was
 * uncovered — only `fromSeed` is used in the shipped code path. It is part of the
 * public surface (extensible factor table), so pin its behaviour.
 */
describe("FactorRepository.fromCollections (QA Phase 7)", () => {
  it("flattens collections into a single resolvable repository", () => {
    const fromColl = FactorRepository.fromCollections([
      epaFactorSet,
      defraDesnzFactorSet,
    ]);
    expect([...fromColl.knownKeys()].sort()).toEqual(
      [...repo.knownKeys()].sort(),
    );
    const r = fromColl.resolve("transport.car.gasoline", { locale: "US" });
    expect(r.value).toBe(8.78);
  });
});
