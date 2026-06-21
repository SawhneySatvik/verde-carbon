import type { Activity } from "@core/schemas";
import { roundForDisplay } from "@core/units";
import type {
  PreviewBreakdownRow,
  PreviewResult,
} from "@core/calculator/preview";

/**
 * Build a `PreviewResult` for the dashboard "show the math" total directly from
 * the STORED activities. Crucially this uses each activity's OWN persisted
 * provenance (`co2eKg`, `factorSet`, `factorSetVersion`, `source`) rather than
 * recomputing — so a number shown here always matches what was stored at log
 * time, even after the user later switches factor sets (historical entries
 * are never recomputed; "click to source" stays truthful).
 */
export function activitiesToPreview(
  activities: readonly Activity[],
): PreviewResult {
  const rows: PreviewBreakdownRow[] = activities.map((a) => ({
    status: "resolved",
    activity: a.activity,
    candidateFactorKey: a.factorKey,
    inputValue: a.quantity,
    inputUnit: a.unit,
    canonicalQuantity: a.quantity,
    canonicalUnit: a.unit,
    factorValue: a.co2eKg === 0 ? 0 : roundForDisplay(a.co2eKg / a.quantity, 6),
    factorSet: a.factorSet,
    factorSetVersion: a.factorSetVersion,
    source: a.source,
    co2eKg: a.co2eKg,
    co2eKgDisplay: roundForDisplay(a.co2eKg),
  }));
  const totalKg = activities.reduce((sum, a) => sum + a.co2eKg, 0);
  return {
    rows,
    totalKg,
    totalKgDisplay: roundForDisplay(totalKg),
    hasUnsourced: false,
    sourcedCount: rows.length,
    unsourcedCount: 0,
  };
}
