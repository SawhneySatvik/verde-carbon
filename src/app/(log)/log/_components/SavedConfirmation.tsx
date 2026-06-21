"use client";

import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { CheckCircle, PlusLog } from "../../../_components/icons";

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Saved screen: the success message, the total CO₂e figure (with an optional
 * partial-exclusion note), and the "Log another" reset button.
 */
export function SavedConfirmation({
  totalKg,
  partial,
  headingRef,
  onReset,
}: {
  totalKg: number;
  partial: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
}) {
  return (
    <m.div
      {...reveal}
      transition={{ duration: 0.44, ease: EASE_OUT_QUART }}
      role="status"
    >
      <Card elevation="raised" accent="success" pad="lg">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex shrink-0 text-success-fg"
          >
            <CheckCircle size={26} />
          </span>
          <div className="min-w-0">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-h3 text-text focus:outline-none"
            >
              Logged — added to your dashboard
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-2">
              <span className="numeric text-display leading-none text-brand-active">
                {totalKg.toFixed(2)}
              </span>
              <span className="text-body text-text-secondary">kg CO₂e</span>
            </p>
            {partial && (
              <p className="mt-2 text-body-sm text-warning-fg">
                Some items were excluded — they couldn&rsquo;t be sourced.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            onClick={onReset}
            leadingIcon={<PlusLog size={18} />}
          >
            Log another
          </Button>
        </div>
      </Card>
    </m.div>
  );
}
