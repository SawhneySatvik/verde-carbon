import { describe, it, expect } from "vitest";
import {
  allFactorRecords,
  epaFactorSet,
  defraDesnzFactorSet,
} from "./seed/index";
import { factorRecordSchema, type FactorRecord } from "@core/schemas";
import { KG_PER_LB, convert } from "@core/units";

function reproduceFromDerivation(record: FactorRecord): number {
  if (!record.sourceNative) {
    throw new Error(`${record.key}: derived record missing sourceNative`);
  }
  if (record.sourceNative.unit === "lb/MWh" && record.canonicalUnit === "kWh") {
    return (record.sourceNative.value * KG_PER_LB) / 1000;
  }
  if (record.sourceNative.unit === "lb/kWh" && record.canonicalUnit === "kWh") {
    return record.sourceNative.value * KG_PER_LB;
  }
  throw new Error(
    `${record.key}: no reproduction rule for ${record.sourceNative.unit} -> ${record.canonicalUnit}`,
  );
}

function parseCloseTo(style: string): { target: number; digits: number } {
  const [, target, digits] = style.split(":");
  return { target: Number(target), digits: Number(digits) };
}

describe("factor seed — schema validity", () => {
  it("every record passes the FactorRecord schema", () => {
    for (const record of allFactorRecords) {
      expect(factorRecordSchema.safeParse(record).success).toBe(true);
    }
  });

  it("both factor sets are stamped with a version on every record", () => {
    expect(
      epaFactorSet.records.every(
        (r) => r.factorSetVersion === epaFactorSet.factorSetVersion,
      ),
    ).toBe(true);
    expect(
      defraDesnzFactorSet.records.every(
        (r) => r.factorSetVersion === defraDesnzFactorSet.factorSetVersion,
      ),
    ).toBe(true);
  });

  it("keys are unique within each factor set", () => {
    for (const set of [epaFactorSet, defraDesnzFactorSet]) {
      const keys = set.records.map((r) => r.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("each set covers transport, energy and diet categories", () => {
    for (const set of [epaFactorSet, defraDesnzFactorSet]) {
      const categories = new Set(set.records.map((r) => r.category));
      expect(categories.has("transport")).toBe(true);
      expect(categories.has("energy")).toBe(true);
      expect(categories.has("diet")).toBe(true);
    }
  });
});

describe("factor seed — assertionStyle consistency (derivation policy)", () => {
  it("a 'toBe' record is published-exact: it carries NO derivation", () => {
    for (const record of allFactorRecords) {
      if (record.assertionStyle === "toBe") {
        expect(record.derivation).toBeUndefined();
      }
    }
  });

  it("a 'toBeCloseTo:*' record is DERIVED: it carries sourceNative AND derivation", () => {
    for (const record of allFactorRecords) {
      if (record.assertionStyle.startsWith("toBeCloseTo")) {
        expect(record.sourceNative).toBeDefined();
        expect(record.derivation).toBeDefined();
        expect(record.derivation && record.derivation.length).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("every derived value reproduces from its recorded sourceNative + derivation", () => {
    const derived = allFactorRecords.filter((r) =>
      r.assertionStyle.startsWith("toBeCloseTo"),
    );
    expect(derived.length).toBeGreaterThan(0);
    for (const record of derived) {
      const reproduced = reproduceFromDerivation(record);
      const { target, digits } = parseCloseTo(record.assertionStyle);
      expect(record.value).toBeCloseTo(reproduced, 12);
      expect(reproduced).toBeCloseTo(target, digits);
    }
  });
});

describe("factor seed — anchor values (the judged 'every number is sourced' promise)", () => {
  const epa = (key: string) => epaFactorSet.records.find((r) => r.key === key)!;

  it("gasoline = 8.78 kg/gallon (EPA, exact -> toBe)", () => {
    const r = epa("transport.car.gasoline");
    expect(r.value).toBe(8.78);
    expect(r.canonicalUnit).toBe("gallon");
    expect(r.assertionStyle).toBe("toBe");
  });

  it("diesel = 10.21 kg/gallon (EPA, exact -> toBe)", () => {
    const r = epa("transport.car.diesel");
    expect(r.value).toBe(10.21);
    expect(r.canonicalUnit).toBe("gallon");
    expect(r.assertionStyle).toBe("toBe");
  });

  it("air short/medium/long = 0.207/0.129/0.163 kg/passenger-mile (EPA, exact -> toBe)", () => {
    expect(epa("transport.air.short").value).toBe(0.207);
    expect(epa("transport.air.medium").value).toBe(0.129);
    expect(epa("transport.air.long").value).toBe(0.163);
    for (const key of [
      "transport.air.short",
      "transport.air.medium",
      "transport.air.long",
    ]) {
      expect(epa(key).canonicalUnit).toBe("passenger-mile");
      expect(epa(key).assertionStyle).toBe("toBe");
    }
  });

  it("US grid stores the genuine published figure (823.1 lb/MWh) and a DERIVED kg/kWh", () => {
    const grid = epa("energy.electricity.grid");
    expect(grid.sourceNative).toEqual({ value: 823.1, unit: "lb/MWh" });
    expect(grid.assertionStyle).toBe("toBeCloseTo:0.373:3");
    expect(grid.canonicalUnit).toBe("kWh");
    expect(grid.value).toBeCloseTo(0.373, 3);
    expect((823.1 * KG_PER_LB) / 1000).toBeCloseTo(grid.value, 12);
  });

  it("the units module reproduces the grid derivation (823.1 lb -> kg over a MWh)", () => {
    const kgPerMwh = convert(823.1, "lb", "kg");
    const kgPerKwh = kgPerMwh / 1000;
    expect(kgPerKwh).toBeCloseTo(0.373, 3);
  });
});
