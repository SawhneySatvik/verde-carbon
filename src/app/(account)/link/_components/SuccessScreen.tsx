"use client";

import { m } from "motion/react";
import Link from "next/link";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Card } from "../../../_components/Card";
import { ArrowUpRight, CheckCircle } from "../../../_components/icons";

/**
 * Final confirmation screen — the saved / merged / kept success card with the
 * back-to-dashboard CTA; copy varies by the resolved phase.
 */

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function SuccessScreen({
  kind,
}: {
  kind: "linked" | "merged" | "kept";
}) {
  return (
    <m.div {...reveal} transition={{ duration: 0.4, ease: EASE_OUT_QUART }}>
      <Card accent="success" pad="lg" role="status">
        <h2 className="inline-flex items-center gap-2 font-display text-h3 text-success-fg">
          <CheckCircle size={22} className="shrink-0" aria-hidden="true" />
          {kind === "merged"
            ? "Merged and saved"
            : kind === "kept"
              ? "Signed in to your existing account"
              : "Saved and synced"}
        </h2>
        <p className="mt-3 max-w-[60ch] text-body text-text-secondary">
          {kind === "kept"
            ? "Your anonymous data is untouched and still here for you."
            : "Your data is now saved to your account and will sync across devices."}
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="group inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            Back to dashboard
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
            >
              <ArrowUpRight size={15} />
            </span>
          </Link>
        </div>
      </Card>
    </m.div>
  );
}
