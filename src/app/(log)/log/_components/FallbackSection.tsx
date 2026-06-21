"use client";

import type { Unit } from "@core/schemas";
import { Card } from "../../../_components/Card";
import { Ripple } from "../../../_components/icons";
import { FallbackForm } from "./FallbackForm";

interface ParsedItem {
  activity: string;
  value: number;
  unit: Unit;
  candidateFactorKey: string;
}

/**
 * Fallback section: the optional info alert explaining why AI parsing fell back,
 * wrapping the existing AI-free `FallbackForm`. `errorRef` focuses the alert.
 */
export function FallbackSection({
  reason,
  errorRef,
  onSubmit,
  onCancel,
}: {
  reason?: string;
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  onSubmit: (items: readonly ParsedItem[]) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      {reason && (
        <Card accent="info" pad="md" innerClassName="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex shrink-0 text-info-fg"
          >
            <Ripple size={20} />
          </span>
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="text-body-sm text-info-fg focus:outline-none"
          >
            {reason} You can still log it below — no AI needed.
          </p>
        </Card>
      )}
      <FallbackForm
        onSubmit={(items) => onSubmit([...items])}
        onCancel={onCancel}
      />
    </div>
  );
}
