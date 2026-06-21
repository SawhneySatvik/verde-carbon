"use client";

import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Card } from "../../../_components/Card";
import { BrandMark } from "../../../_components/BrandMark";
import { ChartLine, Ripple, Target } from "../../../_components/icons";

/**
 * "What carries over" explainer card — states exactly what linking preserves,
 * always visible before sign-in (saving is optional).
 */

const CARRIES: ReadonlyArray<{
  Icon: (props: { size?: number; className?: string }) => React.ReactElement;
  text: React.ReactNode;
}> = [
  {
    Icon: Target,
    text: "Your baseline footprint from onboarding",
  },
  {
    Icon: ChartLine,
    text: <>Every activity you&rsquo;ve logged, with its original source</>,
  },
  {
    Icon: Ripple,
    text: "Your goal and your logging streak",
  },
];

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function CarriesOverSection({ reactId }: { reactId: string }) {
  return (
    <m.section
      {...reveal}
      transition={{ duration: 0.48, delay: 0.06, ease: EASE_OUT_QUART }}
      aria-labelledby={`carries-${reactId}`}
      className="mb-6"
    >
      <Card pad="lg">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
          >
            <BrandMark size={22} />
          </span>
          <div>
            <h2
              id={`carries-${reactId}`}
              className="font-display text-h3 text-text"
            >
              What carries over
            </h2>
            <p className="mt-2 max-w-[60ch] text-body text-text-secondary">
              Signing in links your current anonymous session to your account —
              it does not start over. Everything you&rsquo;ve done so far comes
              with you:
            </p>
          </div>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {CARRIES.map(({ Icon, text }, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-md bg-surface-sunken p-4"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex shrink-0 text-brand-fg"
              >
                <Icon size={18} />
              </span>
              <span className="text-body-sm text-text-secondary">{text}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-body-sm text-text-muted">
          Nothing is re-entered and nothing is deleted. You can keep exploring
          anonymously instead — saving is optional.
        </p>
      </Card>
    </m.section>
  );
}
