/** Shared Insights view types — the calculator-sourced shapes from GET /api/insights. */

export interface FactorBasis {
  candidateFactorKey: string;
  factorValue: number;
  factorSet: "EPA" | "DEFRA_DESNZ";
  factorSetVersion: string;
  source: { name: string; url: string; edition: string; publishedYear: number };
  co2eKg: number;
}

export interface Insight {
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
  reason: string;
  detail: string;
}
