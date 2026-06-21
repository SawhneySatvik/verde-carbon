import type { FactorSource } from "@core/schemas";
import {
  FactorRepository,
  type ResolutionPreference,
} from "../factors/repository";
import { roundForDisplay } from "../units/index";
import {
  calculateItem,
  type CalcFallback,
  type CalcItemInput,
  type CalcResolved,
} from "../calculator/index";

/**
 * A candidate reduction: replace `current` with `alternative`. The projected
 * saving is computed by the calculator for BOTH legs — this module never
 * invents a number, it only ranks calculator output (ADR-001).
 */
export interface ReductionCandidate {
  id: string;
  title: string;
  current: CalcItemInput;
  alternative: CalcItemInput;
}

export interface FactorBasis {
  candidateFactorKey: string;
  factorValue: number;
  factorSet: CalcResolved["factorSet"];
  factorSetVersion: string;
  source: FactorSource;
  co2eKg: number;
}

export interface ReductionInsight {
  id: string;
  title: string;
  rank: number;
  projectedKgSaved: number;
  projectedKgSavedDisplay: number;
  currentBasis: FactorBasis;
  alternativeBasis: FactorBasis;
  phrase: string;
}

export interface SkippedCandidate {
  id: string;
  title: string;
  reason: "current-unresolved" | "alternative-unresolved" | "no-saving";
  detail: string;
}

export interface InsightDerivation {
  insights: readonly ReductionInsight[];
  skipped: readonly SkippedCandidate[];
}

/**
 * Pluggable phrasing. The default is neutral, deterministic text built ONLY from
 * the title + the calculator-derived number. An AI phraser can be injected later;
 * it returns text only and is Zod-validated / never a number at the seam.
 */
export type InsightPhraser = (input: {
  title: string;
  projectedKgSavedDisplay: number;
  rank: number;
}) => string;

export const neutralPhraser: InsightPhraser = ({
  title,
  projectedKgSavedDisplay,
}) => `${title} could save about ${projectedKgSavedDisplay} kg CO2e.`;

function toBasis(r: CalcResolved): FactorBasis {
  return {
    candidateFactorKey: r.candidateFactorKey,
    factorValue: r.factorValue,
    factorSet: r.factorSet,
    factorSetVersion: r.factorSetVersion,
    source: r.source,
    co2eKg: r.co2eKg,
  };
}

export interface DeriveInsightsOptions {
  preference?: ResolutionPreference;
  phraser?: InsightPhraser;
}

/**
 * Rank candidate reductions by calculator-computed projected kg-saved (descending).
 * A candidate whose current or alternative leg cannot be resolved (unknown key,
 * incompatible unit, out-of-bounds value) is SKIPPED with a reason — never
 * folded in with a guessed number. Ties break deterministically by candidate id.
 */
export function deriveReductionInsights(
  repository: FactorRepository,
  candidates: readonly ReductionCandidate[],
  options: DeriveInsightsOptions = {},
): InsightDerivation {
  const phraser = options.phraser ?? neutralPhraser;
  const preference = options.preference ?? {};

  const ranked: Array<Omit<ReductionInsight, "rank" | "phrase">> = [];
  const skipped: SkippedCandidate[] = [];

  for (const candidate of candidates) {
    const current = calculateItem(repository, candidate.current, preference);
    if (current.status === "fallback") {
      skipped.push({
        id: candidate.id,
        title: candidate.title,
        reason: "current-unresolved",
        detail: reasonDetail(current),
      });
      continue;
    }
    const alternative = calculateItem(
      repository,
      candidate.alternative,
      preference,
    );
    if (alternative.status === "fallback") {
      skipped.push({
        id: candidate.id,
        title: candidate.title,
        reason: "alternative-unresolved",
        detail: reasonDetail(alternative),
      });
      continue;
    }

    const projectedKgSaved = current.co2eKg - alternative.co2eKg;
    if (projectedKgSaved <= 0) {
      skipped.push({
        id: candidate.id,
        title: candidate.title,
        reason: "no-saving",
        detail: `Alternative does not reduce emissions (${roundForDisplay(projectedKgSaved)} kg).`,
      });
      continue;
    }

    ranked.push({
      id: candidate.id,
      title: candidate.title,
      projectedKgSaved,
      projectedKgSavedDisplay: roundForDisplay(projectedKgSaved),
      currentBasis: toBasis(current),
      alternativeBasis: toBasis(alternative),
    });
  }

  ranked.sort((a, b) => {
    if (b.projectedKgSaved !== a.projectedKgSaved) {
      return b.projectedKgSaved - a.projectedKgSaved;
    }
    return a.id.localeCompare(b.id);
  });

  const insights: ReductionInsight[] = ranked.map((entry, index) => {
    const rank = index + 1;
    return {
      ...entry,
      rank,
      phrase: phraser({
        title: entry.title,
        projectedKgSavedDisplay: entry.projectedKgSavedDisplay,
        rank,
      }),
    };
  });

  return { insights, skipped };
}

function reasonDetail(fallback: CalcFallback): string {
  return `${fallback.reason}: ${fallback.message}`;
}
