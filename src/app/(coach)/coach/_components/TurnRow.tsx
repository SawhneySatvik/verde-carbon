"use client";

/** One conversation turn — a user message or a coach reply (with optional fallback badge). */

import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Badge } from "../../../_components/Badge";
import { Ripple } from "../../../_components/icons";
import type { Turn } from "../page";

export function TurnRow({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <m.li
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE_OUT_QUART }}
        className="flex flex-col items-end gap-1.5"
      >
        <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
          You
        </span>
        <p className="max-w-[42ch] text-pretty rounded-2xl rounded-tr-sm bg-surface-brand-subtle px-4 py-3 text-body text-text">
          {turn.text}
        </p>
      </m.li>
    );
  }

  return (
    <m.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT_QUART }}
      className="flex flex-col items-start gap-1.5"
    >
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-brand-fg">
        <Ripple size={13} aria-hidden="true" />
        Coach
        {turn.fallback && (
          <Badge tone="neutral" className="ml-1 normal-case tracking-normal">
            General guidance
          </Badge>
        )}
      </span>
      <p
        data-testid="coach-reply"
        className="max-w-[60ch] text-pretty rounded-2xl rounded-tl-sm bg-surface-sunken px-4 py-3 text-body text-text"
      >
        {turn.text}
      </p>
      {turn.fallback && (
        <p className="max-w-[60ch] text-caption text-text-muted">
          The AI coach wasn&rsquo;t available, so this is steady, general
          advice. Your computed figures on the right are unaffected.
        </p>
      )}
    </m.li>
  );
}
