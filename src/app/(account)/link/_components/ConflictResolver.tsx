"use client";

import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { AlertTriangle } from "../../../_components/icons";

/**
 * Conflict resolver — the "already has data" heading plus the keep-vs-merge
 * option cards; nothing happens until the user picks, neither set is overwritten.
 */

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function ConflictResolver({
  reactId,
  headingRef,
  onResolve,
}: {
  reactId: string;
  headingRef: React.Ref<HTMLHeadingElement>;
  onResolve: (resolution: "keep" | "merge") => void;
}) {
  return (
    <m.section
      {...reveal}
      transition={{ duration: 0.4, ease: EASE_OUT_QUART }}
      aria-labelledby={`conflict-${reactId}`}
    >
      <Card accent="warning" pad="lg">
        <h2
          id={`conflict-${reactId}`}
          ref={headingRef}
          tabIndex={-1}
          className="inline-flex items-center gap-2 font-display text-h3 text-warning-fg focus:outline-none"
        >
          <AlertTriangle size={22} className="shrink-0" aria-hidden="true" />
          That account already has data
        </h2>
        <p className="mt-3 max-w-[62ch] text-body text-text-secondary">
          The sign-in you chose is already linked to another account that has
          its own saved data. Choose what to do — nothing happens until you
          pick, and neither set is overwritten silently.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-lg bg-surface-sunken p-5">
            <h3 className="text-h4 text-text">Keep the existing account</h3>
            <p className="mt-2 flex-1 text-body-sm text-text-secondary">
              Sign in to that account as-is. Your current anonymous data stays
              where it is and is <strong>not</strong> merged in — you can come
              back to it.
            </p>
            <div className="mt-4">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => onResolve("keep")}
              >
                Keep existing data
              </Button>
            </div>
          </div>

          <div className="flex flex-col rounded-lg bg-surface-sunken p-5">
            <h3 className="text-h4 text-text">Merge anonymous data in</h3>
            <p className="mt-2 flex-1 text-body-sm text-text-secondary">
              Copy everything from this anonymous session into the existing
              account. Both sets are combined; nothing is deleted. This can be
              run safely without duplicating.
            </p>
            <div className="mt-4">
              <Button fullWidth onClick={() => onResolve("merge")}>
                Merge my data
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </m.section>
  );
}
