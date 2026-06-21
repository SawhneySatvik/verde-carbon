import { describe, it, expect } from "vitest";
import { FactorRepository } from "../factors/repository";
import { calculateItem, type CalcResolved } from "../calculator/index";
import {
  deriveReductionInsights,
  neutralPhraser,
  type InsightPhraser,
  type ReductionCandidate,
} from "./index";

const repo = FactorRepository.fromSeed();

function co2e(input: {
  candidateFactorKey: string;
  value: number;
  unit: Parameters<typeof calculateItem>[1]["unit"];
}): number {
  const r = calculateItem(repo, input, { locale: "US" });
  return (r as CalcResolved).co2eKg;
}

// Diet swaps: beef (6.61) -> chicken (1.82) -> vegetarian (0.69) kg/meal.
const beefToVeg: ReductionCandidate = {
  id: "diet-beef-to-veg",
  title: "Swap a beef meal for a vegetarian meal",
  current: { candidateFactorKey: "diet.meal.beef", value: 1, unit: "meal" },
  alternative: {
    candidateFactorKey: "diet.meal.vegetarian",
    value: 1,
    unit: "meal",
  },
};

const beefToChicken: ReductionCandidate = {
  id: "diet-beef-to-chicken",
  title: "Swap a beef meal for a chicken meal",
  current: { candidateFactorKey: "diet.meal.beef", value: 1, unit: "meal" },
  alternative: {
    candidateFactorKey: "diet.meal.chicken",
    value: 1,
    unit: "meal",
  },
};

describe("deriveReductionInsights — numbers come ONLY from the calculator", () => {
  it("projected kg-saved equals calculator(current) - calculator(alternative)", () => {
    const { insights } = deriveReductionInsights(repo, [beefToVeg], {
      preference: { locale: "US" },
    });
    expect(insights).toHaveLength(1);
    const expected =
      co2e({ candidateFactorKey: "diet.meal.beef", value: 1, unit: "meal" }) -
      co2e({
        candidateFactorKey: "diet.meal.vegetarian",
        value: 1,
        unit: "meal",
      });
    expect(insights[0]?.projectedKgSaved).toBeCloseTo(expected, 12);
    expect(insights[0]?.projectedKgSaved).toBeCloseTo(6.61 - 0.69, 12);
  });

  it("carries the factor basis + source refs for both legs (provenance)", () => {
    const { insights } = deriveReductionInsights(repo, [beefToVeg], {
      preference: { locale: "US" },
    });
    const insight = insights[0]!;
    expect(insight.currentBasis.candidateFactorKey).toBe("diet.meal.beef");
    expect(insight.currentBasis.factorValue).toBe(6.61);
    expect(insight.currentBasis.source.name).toContain("EPA");
    expect(insight.alternativeBasis.candidateFactorKey).toBe(
      "diet.meal.vegetarian",
    );
    expect(insight.alternativeBasis.factorValue).toBe(0.69);
    expect(insight.alternativeBasis.factorSetVersion).toBe(
      "EPA-GHG-Hub-2025.1",
    );
  });
});

describe("ranking by projected kg-saved (descending)", () => {
  it("ranks the bigger saving first and assigns 1-based ranks", () => {
    const { insights } = deriveReductionInsights(
      repo,
      [beefToChicken, beefToVeg],
      {
        preference: { locale: "US" },
      },
    );
    expect(insights.map((i) => i.id)).toEqual([
      "diet-beef-to-veg",
      "diet-beef-to-chicken",
    ]);
    expect(insights.map((i) => i.rank)).toEqual([1, 2]);
    expect(insights[0]!.projectedKgSaved).toBeGreaterThan(
      insights[1]!.projectedKgSaved,
    );
  });

  it("breaks ties deterministically by candidate id", () => {
    const a: ReductionCandidate = {
      id: "b-second",
      title: "Tie B",
      current: { candidateFactorKey: "diet.meal.beef", value: 1, unit: "meal" },
      alternative: {
        candidateFactorKey: "diet.meal.vegetarian",
        value: 1,
        unit: "meal",
      },
    };
    const b: ReductionCandidate = {
      id: "a-first",
      title: "Tie A",
      current: { candidateFactorKey: "diet.meal.beef", value: 1, unit: "meal" },
      alternative: {
        candidateFactorKey: "diet.meal.vegetarian",
        value: 1,
        unit: "meal",
      },
    };
    const { insights } = deriveReductionInsights(repo, [a, b], {
      preference: { locale: "US" },
    });
    expect(insights.map((i) => i.id)).toEqual(["a-first", "b-second"]);
  });
});

describe("never invents numbers — unresolved legs are skipped with a reason", () => {
  it("skips a candidate whose current leg has an unknown key", () => {
    const bad: ReductionCandidate = {
      id: "bad-current",
      title: "Bad current",
      current: {
        candidateFactorKey: "diet.meal.dragon",
        value: 1,
        unit: "meal",
      },
      alternative: {
        candidateFactorKey: "diet.meal.vegetarian",
        value: 1,
        unit: "meal",
      },
    };
    const { insights, skipped } = deriveReductionInsights(repo, [bad], {
      preference: { locale: "US" },
    });
    expect(insights).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toBe("current-unresolved");
    expect(skipped[0]?.detail).toContain("unknown-key");
  });

  it("skips a candidate whose alternative leg has an incompatible unit", () => {
    const bad: ReductionCandidate = {
      id: "bad-alt-unit",
      title: "Bad alt unit",
      current: { candidateFactorKey: "diet.meal.beef", value: 1, unit: "meal" },
      alternative: {
        candidateFactorKey: "diet.meal.vegetarian",
        value: 1,
        unit: "gallon",
      },
    };
    const { insights, skipped } = deriveReductionInsights(repo, [bad], {
      preference: { locale: "US" },
    });
    expect(insights).toHaveLength(0);
    expect(skipped[0]?.reason).toBe("alternative-unresolved");
    expect(skipped[0]?.detail).toContain("incompatible-unit");
  });

  it("skips a swap that does not reduce emissions (no-saving), never showing a negative saving", () => {
    const worse: ReductionCandidate = {
      id: "veg-to-beef",
      title: "Swap vegetarian for beef",
      current: {
        candidateFactorKey: "diet.meal.vegetarian",
        value: 1,
        unit: "meal",
      },
      alternative: {
        candidateFactorKey: "diet.meal.beef",
        value: 1,
        unit: "meal",
      },
    };
    const { insights, skipped } = deriveReductionInsights(repo, [worse], {
      preference: { locale: "US" },
    });
    expect(insights).toHaveLength(0);
    expect(skipped[0]?.reason).toBe("no-saving");
  });
});

describe("pluggable phrasing (AI later) defaulting to neutral deterministic text", () => {
  it("the default neutral phraser produces deterministic, number-bearing-from-calculator text", () => {
    const { insights } = deriveReductionInsights(repo, [beefToVeg], {
      preference: { locale: "US" },
    });
    const insight = insights[0]!;
    expect(insight.phrase).toBe(
      neutralPhraser({
        title: insight.title,
        projectedKgSavedDisplay: insight.projectedKgSavedDisplay,
        rank: insight.rank,
      }),
    );
    expect(insight.phrase).toContain(String(insight.projectedKgSavedDisplay));
  });

  it("accepts an injected phraser without changing the number", () => {
    const customPhraser: InsightPhraser = ({ rank, title }) =>
      `#${rank}: ${title}`;
    const { insights } = deriveReductionInsights(repo, [beefToVeg], {
      preference: { locale: "US" },
      phraser: customPhraser,
    });
    expect(insights[0]?.phrase).toBe(
      "#1: Swap a beef meal for a vegetarian meal",
    );
    // the injected phraser cannot influence the calculator-derived saving:
    expect(insights[0]?.projectedKgSaved).toBeCloseTo(6.61 - 0.69, 12);
  });
});

describe("locale-aware derivation", () => {
  it("uses the DEFRA per-km car factors under a UK preference", () => {
    const carSwap: ReductionCandidate = {
      id: "car-shorter-trip",
      title: "Drive 50 km instead of 100 km",
      current: {
        candidateFactorKey: "transport.car.gasoline",
        value: 100,
        unit: "km",
      },
      alternative: {
        candidateFactorKey: "transport.car.gasoline",
        value: 50,
        unit: "km",
      },
    };
    const { insights } = deriveReductionInsights(repo, [carSwap], {
      preference: { locale: "UK" },
    });
    expect(insights[0]?.currentBasis.factorSet).toBe("DEFRA_DESNZ");
    expect(insights[0]?.projectedKgSaved).toBeCloseTo(50 * 0.16844, 10);
  });
});
