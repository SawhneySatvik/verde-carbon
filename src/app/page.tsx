"use client";

import Link from "next/link";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Badge } from "./_components/Badge";
import { Card } from "./_components/Card";
import { BrandMark } from "./_components/BrandMark";
import { ArrowUpRight } from "./_components/icons";

/**
 * Welcome screen.
 *
 * Anonymous entry, no sign-in wall: one clear <h1>, a single primary CTA
 * "Estimate my footprint" that starts the wizard, and a secondary
 * "How this works" link to the transparency explainer. The anonymous-mode
 * banner lives in the shell (layout); test hooks preserved verbatim
 * (h1 matches /carbon footprint/i, link named /Estimate my footprint/i).
 *
 * Look (Soft Structuralism × Editorial Split): an asymmetric hero — a big
 * Space-Grotesk display headline + lead + CTAs on the left, a "brand moment"
 * instrument panel (the Concentric Ripple BrandMark over a soft strata/contour
 * motif, brand wash) floating on the right. The three identical value-prop
 * cards are replaced by an editorial numbered honesty-promise list inside the
 * Double-Bezel Card primitive, with elevation hierarchy (the first claim is
 * raised, the rest rest).
 *
 * Motion: a tasteful staggered reveal via `m` (under the shared LazyMotion
 * provider). Content is visible by default — reveals run on mount (initial →
 * animate, never gated on scroll/visibility) and are transform/opacity only, so
 * they are reduced-motion safe automatically through MotionConfig
 * reducedMotion="user".
 */

const PROMISE: ReadonlyArray<{
  n: string;
  title: string;
  body: string;
}> = [
  {
    n: "01",
    title: "AI parses, never computes",
    body: "The model only turns your words into structured items — activity, quantity, unit. It is structurally prevented from returning a CO₂e number.",
  },
  {
    n: "02",
    title: "A calculator does the math",
    body: "Every figure comes from a deterministic calculator and a published emission factor. The same inputs always give the same number.",
  },
  {
    n: "03",
    title: "Sourced, and shown first",
    body: "You see the breakdown and its published source before you save. Nothing is logged until you confirm it.",
  },
];

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-app px-4 py-16 md:px-6 md:py-24 lg:px-8">
      {/* ---------------------------------------------------------------- hero */}
      <section
        aria-labelledby="welcome-title"
        className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10"
      >
        {/* Left — editorial copy column (wider). */}
        <div className="lg:col-span-7">
          <m.div
            {...reveal}
            transition={{ duration: 0.48, ease: EASE_OUT_QUART }}
          >
            <Badge tone="brand" eyebrow>
              Carbon footprint, made honest
            </Badge>
          </m.div>

          <m.h1
            id="welcome-title"
            {...reveal}
            transition={{ duration: 0.48, delay: 0.06, ease: EASE_OUT_QUART }}
            className="mt-5 max-w-[16ch] text-balance font-display text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.04] tracking-[-0.02em] text-text"
          >
            Shrink your carbon footprint, on numbers you can trust.
          </m.h1>

          <m.p
            {...reveal}
            transition={{ duration: 0.48, delay: 0.12, ease: EASE_OUT_QUART }}
            className="mt-6 max-w-[54ch] text-pretty text-body-lg text-text-secondary"
          >
            Describe your day in plain language. Verdé shows you the parsed
            activities, the computed CO₂e, and the published source for every
            figure — before anything is saved. No account needed to start.
          </m.p>

          <m.div
            {...reveal}
            transition={{ duration: 0.48, delay: 0.18, ease: EASE_OUT_QUART }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            {/* Primary CTA — a real <a> (anchor) so it keeps the link role the
                core-loop e2e relies on, styled to the primary Button material
                incl. the button-in-button trailing island (soft-skill §4B). */}
            <Link
              href="/wizard"
              className="group inline-flex min-h-[48px] w-full select-none items-center justify-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium leading-none text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98] sm:w-auto"
            >
              Estimate my footprint
              <span
                aria-hidden="true"
                className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
              >
                <ArrowUpRight size={18} />
              </span>
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-sm border border-border-interactive bg-surface px-6 py-3 text-body font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] sm:w-auto"
            >
              How this works
            </Link>
          </m.div>

          <m.p
            {...reveal}
            transition={{ duration: 0.48, delay: 0.24, ease: EASE_OUT_QUART }}
            className="mt-6 text-body-sm text-text-muted"
          >
            Prefer to log right away?{" "}
            <Link
              href="/log"
              className="rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
            >
              Log a single activity
            </Link>
            .
          </m.p>
        </div>

        {/* Right — the brand moment: a floating "instrument" panel. */}
        <m.div
          {...reveal}
          transition={{ duration: 0.56, delay: 0.14, ease: EASE_OUT_QUART }}
          className="lg:col-span-5"
        >
          <HeroInstrument />
        </m.div>
      </section>

      {/* -------------------------------------------------- honesty promise */}
      <section
        aria-label="What makes Verdé trustworthy"
        className="mt-20 md:mt-28"
      >
        <m.div
          {...reveal}
          transition={{ duration: 0.48, ease: EASE_OUT_QUART }}
          className="max-w-[46ch]"
        >
          <h2 className="font-display text-h2 text-balance text-text">
            One promise, kept on every figure.
          </h2>
          <p className="mt-3 text-body text-text-secondary">
            Verdé separates the language from the arithmetic — so a number is
            never a guess.
          </p>
        </m.div>

        <ol className="mt-10 grid gap-5 lg:grid-cols-12">
          {PROMISE.map((item, i) => (
            <m.li
              key={item.n}
              {...reveal}
              transition={{
                duration: 0.44,
                delay: 0.06 * i,
                ease: EASE_OUT_QUART,
              }}
              className={
                i === 0 ? "lg:col-span-6 lg:row-span-2" : "lg:col-span-6"
              }
            >
              <Card
                elevation={i === 0 ? "raised" : "rest"}
                pad={i === 0 ? "lg" : "md"}
                className="h-full"
                innerClassName="flex h-full flex-col"
              >
                <span
                  aria-hidden="true"
                  className="numeric text-overline tracking-[0.16em] text-brand-fg"
                >
                  {item.n}
                </span>
                <h3
                  className={[
                    "mt-3 text-text",
                    i === 0 ? "font-display text-h2" : "text-h3",
                  ].join(" ")}
                >
                  {item.title}
                </h3>
                <p
                  className={[
                    "mt-2 text-pretty text-text-secondary",
                    i === 0 ? "text-body-lg" : "text-body",
                  ].join(" ")}
                >
                  {item.body}
                </p>
              </Card>
            </m.li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * The hero "instrument" — a brand moment, not a stock illustration. The
 * Concentric Ripple BrandMark floats over a soft strata / contour-line motif on
 * a layered brand-washed surface, reading as a calm measuring dial. Decorative:
 * the whole panel is aria-hidden (the headline + copy carry all meaning).
 */
function HeroInstrument() {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring] shadow-float"
    >
      <div className="relative overflow-hidden rounded-bezel-inner bg-surface-raised shadow-bezel-inner">
        {/* Brand wash — green stays a minor accent, ≤15% of the surface. */}
        <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-surface-brand-subtle to-transparent" />

        {/* Soft strata / contour lines — the topographic measuring motif. */}
        <svg
          viewBox="0 0 320 320"
          className="absolute inset-0 h-full w-full text-brand"
          preserveAspectRatio="xMidYMid slice"
        >
          {[0, 1, 2, 3, 4].map((row) => (
            <path
              key={row}
              d={`M-20 ${120 + row * 44} C 60 ${100 + row * 44}, 120 ${
                150 + row * 44
              }, 200 ${128 + row * 44} S 320 ${108 + row * 44}, 340 ${
                132 + row * 44
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.14 - row * 0.02}
            />
          ))}
        </svg>

        {/* The ripple seed — one action radiating outward. */}
        <div className="relative flex aspect-square items-center justify-center p-6 md:p-10">
          <m.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.56, delay: 0.3, ease: EASE_OUT_QUART }}
            className="flex h-40 w-40 items-center justify-center rounded-pill bg-surface text-brand shadow-float ring-1 ring-[--bezel-ring]"
          >
            <BrandMark size={104} />
          </m.div>
        </div>

        {/* A small honest "measured, not guessed" instrument caption strip. */}
        <div className="relative flex items-center justify-between gap-3 border-t border-border bg-surface-raised px-5 py-4">
          <span className="text-caption text-text-muted">Every figure</span>
          <span className="numeric inline-flex items-center gap-2 text-body-sm font-medium text-brand-fg">
            <span className="inline-block h-2 w-2 rounded-pill bg-brand" />
            measured, not guessed
          </span>
        </div>
      </div>
    </div>
  );
}
