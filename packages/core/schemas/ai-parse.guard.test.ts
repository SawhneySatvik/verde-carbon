import { describe, it, expect, expectTypeOf } from "vitest";
import {
  aiParseItemSchema,
  aiParseResultSchema,
  type AiParseItem,
  type AiParseResult,
} from "./ai-parse.schema";
import { MAX_QUANTITY } from "./domain";

const validItem = {
  activity: "drove to work",
  value: 20,
  unit: "mile",
  candidateFactorKey: "transport.car.gasoline",
  confidence: 0.9,
};

describe("AI parse schema — structural guarantee (ADR-001)", () => {
  it("accepts a well-formed parse item", () => {
    const parsed = aiParseItemSchema.parse(validItem);
    expect(parsed).toEqual(validItem);
  });

  it("accepts a result with items and optional clarification", () => {
    const result = aiParseResultSchema.parse({
      items: [validItem],
      clarification: "Did you mean diesel or gasoline?",
    });
    expect(result.items).toHaveLength(1);
    expect(result.clarification).toBe("Did you mean diesel or gasoline?");
  });

  describe("the schema structurally cannot carry a CO2e / emission number", () => {
    it("rejects an item carrying a co2eKg field", () => {
      const r = aiParseItemSchema.safeParse({ ...validItem, co2eKg: 5.2 });
      expect(r.success).toBe(false);
    });

    it("rejects an item carrying an emissions field", () => {
      const r = aiParseItemSchema.safeParse({ ...validItem, emissions: 5.2 });
      expect(r.success).toBe(false);
    });

    it("rejects an item carrying a co2e field", () => {
      const r = aiParseItemSchema.safeParse({ ...validItem, co2e: 5.2 });
      expect(r.success).toBe(false);
    });

    it("rejects an item carrying a kgCO2e field", () => {
      const r = aiParseItemSchema.safeParse({ ...validItem, kgCO2e: 5.2 });
      expect(r.success).toBe(false);
    });

    it("rejects any unknown extra field (strict object)", () => {
      const r = aiParseItemSchema.safeParse({ ...validItem, anything: 1 });
      expect(r.success).toBe(false);
    });

    it("rejects an emission number smuggled at the result level", () => {
      const r = aiParseResultSchema.safeParse({
        items: [validItem],
        totalCo2eKg: 12.3,
      });
      expect(r.success).toBe(false);
    });

    it("the inferred TYPE has no numeric emission field — only the parse vocabulary", () => {
      expectTypeOf<keyof AiParseItem>().toEqualTypeOf<
        "activity" | "value" | "unit" | "candidateFactorKey" | "confidence"
      >();
      expectTypeOf<keyof AiParseResult>().toEqualTypeOf<
        "items" | "clarification"
      >();
    });
  });

  describe("value is bounded, finite and in (0, MAX]", () => {
    it("rejects NaN", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, value: NaN }).success,
      ).toBe(false);
    });

    it("rejects Infinity", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, value: Infinity }).success,
      ).toBe(false);
    });

    it("rejects zero", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, value: 0 }).success,
      ).toBe(false);
    });

    it("rejects negative values", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, value: -5 }).success,
      ).toBe(false);
    });

    it("rejects values over MAX_QUANTITY", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, value: MAX_QUANTITY + 1 })
          .success,
      ).toBe(false);
    });

    it("accepts exactly MAX_QUANTITY", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, value: MAX_QUANTITY })
          .success,
      ).toBe(true);
    });
  });

  describe("unit is a closed enum — no free-text units", () => {
    it("rejects an unknown free-text unit", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, unit: "furlong" }).success,
      ).toBe(false);
    });

    it("rejects an empty unit", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, unit: "" }).success,
      ).toBe(false);
    });

    it("accepts a known vocabulary unit", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, unit: "km" }).success,
      ).toBe(true);
    });
  });

  describe("candidateFactorKey is a non-empty string (vocab check lives in the repository)", () => {
    it("rejects an empty key", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, candidateFactorKey: "" })
          .success,
      ).toBe(false);
    });

    it("rejects a non-string key", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, candidateFactorKey: 42 })
          .success,
      ).toBe(false);
    });
  });

  describe("confidence is bounded [0, 1]", () => {
    it("rejects confidence above 1", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, confidence: 1.5 }).success,
      ).toBe(false);
    });

    it("rejects confidence below 0", () => {
      expect(
        aiParseItemSchema.safeParse({ ...validItem, confidence: -0.1 }).success,
      ).toBe(false);
    });
  });
});
