"use client";

import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { AlertTriangle, Lock } from "../../../_components/icons";

/**
 * Presentational running-total tile: the hero CO₂e figure, Cancel/Log it
 * controls, and the save-blocking reason text. The save gate is computed upstream.
 */
export function TotalCard({
  totalKgDisplay,
  hasUnsourced,
  sourcedCount,
  blockingCount,
  canSave,
  saving,
  reasonId,
  onSave,
  onCancel,
}: {
  totalKgDisplay: number;
  hasUnsourced: boolean;
  sourcedCount: number;
  blockingCount: number;
  canSave: boolean;
  saving: boolean;
  reasonId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Card elevation="raised" accent="brand" pad="lg">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-caption uppercase tracking-[0.06em] text-text-muted">
            Running total
            {hasUnsourced && (
              <span className="font-medium normal-case tracking-normal text-warning-fg">
                (sourced items only)
              </span>
            )}
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span
              className="numeric text-display leading-none text-brand-active"
              aria-hidden="true"
            >
              {totalKgDisplay.toFixed(2)}
            </span>
            <span className="text-body text-text-secondary">kg CO₂e</span>
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-body-sm text-text-muted">
            <Lock size={14} className="shrink-0" aria-hidden="true" />
            Not saved yet — review, then log it.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            loading={saving}
            disabled={!canSave && !saving}
            aria-disabled={!canSave}
            aria-describedby={!canSave ? reasonId : undefined}
          >
            {saving ? "Logging…" : "Log it"}
          </Button>
        </div>
      </div>

      {!canSave && !saving && (
        <p
          id={reasonId}
          className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-body-sm text-warning-fg"
        >
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {sourcedCount === 0
              ? "Add at least one sourceable item to log."
              : `${blockingCount} item${blockingCount === 1 ? "" : "s"} still need a source — pick a factor above to continue.`}
          </span>
        </p>
      )}
    </Card>
  );
}
