import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { FactorRepository } from "../factors/repository";
import { roundForDisplay } from "../units/index";
import { calculateTotals, type CalcItemInput } from "./index";
import {
  previewActivities,
  previewWithRepository,
  type PreviewBreakdownRow,
  type PreviewResult,
} from "./preview";

const repo = FactorRepository.fromSeed();

const sampleSet: readonly CalcItemInput[] = [
  {
    candidateFactorKey: "transport.car.gasoline",
    value: 2,
    unit: "gallon",
    activity: "drove to work",
  },
  {
    candidateFactorKey: "transport.air.short",
    value: 100,
    unit: "passenger-mile",
    activity: "short flight",
  },
  {
    candidateFactorKey: "transport.teleporter.warp",
    value: 5,
    unit: "gallon",
    activity: "warp jump",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("preview performs NO I/O / persistence (show-before-save)", () => {
  it("does not call fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("preview must not perform network I/O");
    });
    expect(() => previewActivities(sampleSet, { locale: "US" })).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is synchronous and returns a plain value (no Promise / DataPort)", () => {
    const result = previewActivities(sampleSet, { locale: "US" });
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.totalKg).toBe("number");
  });

  it("the preview module imports no server-only / persistence module", () => {
    const src = readFileSync(new URL("./preview.ts", import.meta.url), "utf8");
    const importLines = src
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line) || /\brequire\(/.test(line));
    const importBlob = importLines.join("\n");
    expect(importBlob).not.toMatch(/firebase/);
    expect(importBlob).not.toMatch(/@google-cloud/);
    expect(importBlob).not.toMatch(/["']node:/);
    expect(importBlob).not.toMatch(/\.\.\/ports/);
    expect(src).toContain('"use client"');
  });
});

describe("parity — preview yields the SAME numbers as the calculator", () => {
  it("per-item co2eKg matches calculateTotals exactly", () => {
    const oracle = calculateTotals(repo, sampleSet, { locale: "US" });
    const preview = previewWithRepository(repo, sampleSet, { locale: "US" });

    const resolvedOracle = oracle.resolved;
    const resolvedPreview = preview.rows.filter(
      (r): r is PreviewBreakdownRow => r.status === "resolved",
    );
    expect(resolvedPreview).toHaveLength(resolvedOracle.length);
    resolvedPreview.forEach((row, i) => {
      expect(row.co2eKg).toBe(resolvedOracle[i]?.co2eKg);
      expect(row.factorValue).toBe(resolvedOracle[i]?.factorValue);
    });
  });

  it("total matches calculateTotals exactly (unsourced excluded)", () => {
    const oracle = calculateTotals(repo, sampleSet, { locale: "US" });
    const preview = previewWithRepository(repo, sampleSet, { locale: "US" });
    expect(preview.totalKg).toBe(oracle.totalKg);
    expect(preview.totalKg).toBeCloseTo(2 * 8.78 + 100 * 0.207, 10);
  });

  it("previewActivities (seed-built repo) matches an explicit-repo preview", () => {
    const a = previewActivities(sampleSet, { locale: "US" });
    const b = previewWithRepository(repo, sampleSet, { locale: "US" });
    expect(a.totalKg).toBe(b.totalKg);
  });
});

describe("breakdown shape (per-item + total + provenance)", () => {
  let result: PreviewResult;

  beforeEach(() => {
    result = previewActivities(sampleSet, { locale: "US" });
  });

  it("exposes a row per input item", () => {
    expect(result.rows).toHaveLength(sampleSet.length);
  });

  it("flags the unsourced item and excludes it from the total", () => {
    expect(result.hasUnsourced).toBe(true);
    expect(result.unsourcedCount).toBe(1);
    expect(result.sourcedCount).toBe(2);
    const unsourced = result.rows.find((r) => r.status === "unsourced");
    expect(unsourced?.status).toBe("unsourced");
  });

  it("carries factor source + display rounding for show-the-math", () => {
    const row = result.rows.find(
      (r): r is PreviewBreakdownRow => r.status === "resolved",
    );
    expect(row?.source.name).toContain("EPA");
    expect(row?.co2eKgDisplay).toBe(roundForDisplay(row!.co2eKg));
  });

  it("total display rounding uses the unit display-precision policy", () => {
    expect(result.totalKgDisplay).toBe(roundForDisplay(result.totalKg));
  });
});
