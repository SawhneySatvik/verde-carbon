// packages/core — the pure, framework-free domain (ADR-002, ADR-005).
// No React, Next, firebase, or @google-cloud imports here: the core depends on
// ports only and is unit-tested in isolation.
export * from "./schemas";
export * from "./ports";
export * as units from "./units";
export {
  FactorRepository,
  LOCALE_DEFAULTS,
  UnknownFactorKeyError,
} from "./factors/repository";
export type {
  LocaleDefaults,
  ResolutionPreference,
} from "./factors/repository";
export {
  allFactorRecords,
  epaFactorSet,
  defraDesnzFactorSet,
  factorCollections,
} from "./factors/seed/index";
export {
  calculateItem,
  calculateTotals,
  MAX_CO2E_QUANTITY,
} from "./calculator/index";
export type {
  CalcItemInput,
  CalcItemResult,
  CalcResolved,
  CalcFallback,
  CalcTotals,
  CalcRejectionReason,
} from "./calculator/index";
export { previewActivities, previewWithRepository } from "./calculator/preview";
export type {
  PreviewResult,
  PreviewRow,
  PreviewBreakdownRow,
  PreviewUnsourcedRow,
} from "./calculator/preview";
export { deriveReductionInsights, neutralPhraser } from "./insights/index";
export type {
  ReductionCandidate,
  ReductionInsight,
  InsightDerivation,
  InsightPhraser,
  FactorBasis,
  SkippedCandidate,
  DeriveInsightsOptions,
} from "./insights/index";
