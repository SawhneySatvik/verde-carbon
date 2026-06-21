"use client";

// CLIENT-IMPORTABLE, SIDE-EFFECT-FREE preview compute ("show before save").
// Imported directly by the Parse Confirmation screen and reused by the
// optional POST /api/activities?preview=1 endpoint. It performs ZERO I/O
// and ZERO persistence: no DataPort, no fetch, no fs, no firebase/@google-cloud,
// no node/server-only imports — only the pure calculator + repository + units.
// It yields the SAME numbers as the calculator (parity is unit-tested).

import type { FactorSource, Unit } from "@core/schemas";
import {
  FactorRepository,
  type ResolutionPreference,
} from "../factors/repository";
import { roundForDisplay } from "../units/index";
import {
  calculateTotals,
  type CalcFallback,
  type CalcItemInput,
  type CalcResolved,
  type CalcTotals,
} from "./index";

export interface PreviewBreakdownRow {
  status: "resolved";
  activity?: string;
  candidateFactorKey: string;
  inputValue: number;
  inputUnit: Unit;
  canonicalQuantity: number;
  canonicalUnit: Unit;
  factorValue: number;
  factorSet: CalcResolved["factorSet"];
  factorSetVersion: string;
  source: FactorSource;
  co2eKg: number;
  co2eKgDisplay: number;
}

export interface PreviewUnsourcedRow {
  status: "unsourced";
  activity?: string;
  candidateFactorKey: unknown;
  inputValue: number;
  inputUnit: Unit;
  reason: CalcFallback["reason"];
  message: string;
}

export type PreviewRow = PreviewBreakdownRow | PreviewUnsourcedRow;

export interface PreviewResult {
  rows: readonly PreviewRow[];
  totalKg: number;
  totalKgDisplay: number;
  hasUnsourced: boolean;
  sourcedCount: number;
  unsourcedCount: number;
}

function toBreakdownRow(r: CalcResolved): PreviewBreakdownRow {
  return {
    status: "resolved",
    activity: r.activity,
    candidateFactorKey: r.candidateFactorKey,
    inputValue: r.inputValue,
    inputUnit: r.inputUnit,
    canonicalQuantity: r.canonicalQuantity,
    canonicalUnit: r.canonicalUnit,
    factorValue: r.factorValue,
    factorSet: r.factorSet,
    factorSetVersion: r.factorSetVersion,
    source: r.source,
    co2eKg: r.co2eKg,
    co2eKgDisplay: roundForDisplay(r.co2eKg),
  };
}

function toUnsourcedRow(f: CalcFallback): PreviewUnsourcedRow {
  return {
    status: "unsourced",
    activity: f.activity,
    candidateFactorKey: f.candidateFactorKey,
    inputValue: f.inputValue,
    inputUnit: f.inputUnit,
    reason: f.reason,
    message: f.message,
  };
}

function shape(totals: CalcTotals): PreviewResult {
  const rows: PreviewRow[] = totals.items.map((item) =>
    item.status === "resolved" ? toBreakdownRow(item) : toUnsourcedRow(item),
  );
  return {
    rows,
    totalKg: totals.totalKg,
    totalKgDisplay: roundForDisplay(totals.totalKg),
    hasUnsourced: totals.hasUnsourced,
    sourcedCount: totals.resolved.length,
    unsourcedCount: totals.fallbacks.length,
  };
}

/**
 * Compute a full preview (per-item + total + breakdown) from an explicit
 * repository, WITHOUT any persistence. Use this overload when the caller already
 * holds a FactorRepository (e.g. the server preview endpoint reuses one instance).
 */
export function previewWithRepository(
  repository: FactorRepository,
  inputs: readonly CalcItemInput[],
  preference: ResolutionPreference = {},
): PreviewResult {
  return shape(calculateTotals(repository, inputs, preference));
}

/**
 * Client-friendly entry point: builds the repository from the bundled seed (pure,
 * synchronous, no I/O) and computes the preview. Safe to import from a
 * "use client" component.
 */
export function previewActivities(
  inputs: readonly CalcItemInput[],
  preference: ResolutionPreference = {},
): PreviewResult {
  return previewWithRepository(FactorRepository.fromSeed(), inputs, preference);
}
