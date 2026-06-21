"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import type { Locale, UnitSystem } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Card } from "../../_components/Card";
import { Button } from "../../_components/Button";
import { StepHomeEnergy } from "./_components/StepHomeEnergy";
import { StepTransport } from "./_components/StepTransport";
import { StepDiet } from "./_components/StepDiet";
import { StepReview } from "./_components/StepReview";
import { buildWizardItems, convertAnswers } from "./_components/buildItems";
import {
  EMPTY_ANSWERS,
  STEP_TITLES,
  type WizardAnswers,
} from "./_components/types";

/**
 * Onboarding wizard.
 *
 * 4 steps (Home energy → Transport → Diet → Review). Each input step is a
 * labelled <form> with a <fieldset>/<legend> group; step progress is announced
 * ("Step 2 of 4"); the unit/factor-set is a visible, changeable control whose
 * change converts entered values IN PLACE and is ANNOUNCED (WCAG 3.3.7 redundant
 * entry). All answers live in one state object, so moving
 * Back/Next never asks the user to re-enter anything. The Review step computes
 * the baseline via the client-importable preview module — no number is invented.
 *
 * An editorial header
 * (eyebrow Badge + Space-Grotesk display heading) sits over a refined progress
 * rail (a `scaleX` transform fill, motion-safe). The step body floats in the
 * Double-Bezel `Card` material; the factor-set / unit selectors are segmented
 * pressed toggles; nav uses the `Button` primitive (button-in-button press).
 * Each step swap fades/rises in via `m` (under the shared LazyMotion provider) —
 * transform/opacity only, so it is reduced-motion safe through MotionConfig
 * reducedMotion="user". The keyed reveal mounts synchronously (no AnimatePresence
 * exit-wait), so the focus-into-new-step behavior (WCAG 2.4.3) is preserved
 * exactly: the persistent `stepHeadingRef` wrapper still contains the new group
 * the instant we focus it.
 */

const TOTAL_STEPS = STEP_TITLES.length;

export default function WizardPage() {
  const { announce } = useAnnouncer();
  const [step, setStep] = useState(0); // 0..3
  const [locale, setLocale] = useState<Locale>("US");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_ANSWERS);
  const [unsure, setUnsure] = useState<Record<string, boolean>>({});
  // When the step changes (Next/Back), move focus INTO the new step so a
  // keyboard / screen-reader user's focus follows the flow rather than being
  // stranded on the now-removed control (WCAG 2.4.3 Focus Order). Mirrors the
  // focus-on-change pattern in dashboard/insights/link.
  const stepHeadingRef = useRef<HTMLDivElement | null>(null);
  // Skip the initial mount so we don't steal focus on first paint; only move
  // focus on a deliberate step change.
  const didMountStep = useRef(false);

  const items = useMemo(
    () => buildWizardItems(answers, unsure, unitSystem),
    [answers, unsure, unitSystem],
  );

  function setAnswer(key: keyof WizardAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }
  function setUnsureKey(key: string, value: boolean) {
    setUnsure((prev) => ({ ...prev, [key]: value }));
  }

  function handleUnitSystem(next: UnitSystem) {
    if (next === unitSystem) {
      return;
    }
    const { answers: converted, changed } = convertAnswers(
      answers,
      unitSystem,
      next,
    );
    setAnswers(converted);
    setUnitSystem(next);
    announce(
      changed.length > 0
        ? `Units changed to ${next}. ${changed.length} value${changed.length === 1 ? "" : "s"} converted in place — nothing was lost.`
        : `Units changed to ${next}.`,
    );
  }

  function handleLocale(next: Locale) {
    if (next === locale) {
      return;
    }
    setLocale(next);
    announce(
      `Factor set changed to ${next === "UK" ? "UK DEFRA/DESNZ" : "US EPA"}. Your figures will recompute from the calculator.`,
    );
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next));
    setStep(clamped);
    announce(`Step ${clamped + 1} of ${TOTAL_STEPS}: ${STEP_TITLES[clamped]}.`);
  }

  // Focus the new step's group after it renders (focus + announce together).
  useEffect(() => {
    if (!didMountStep.current) {
      didMountStep.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  const isReview = step === TOTAL_STEPS - 1;
  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <div className="mx-auto max-w-prose px-4 py-16 md:px-6 md:py-20">
      <header className="mb-10">
        <Badge tone="brand" eyebrow>
          Build your baseline
        </Badge>
        <h1 className="mt-4 text-balance font-display text-h1 text-text">
          Estimate your footprint
        </h1>

        {/* Step progress — announced as text, not color-only. */}
        <div className="mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-body-sm font-medium text-text-secondary">
              Step {step + 1} of {TOTAL_STEPS}:{" "}
              <span className="text-text">{STEP_TITLES[step]}</span>
            </p>
            <p className="numeric text-caption tabular-nums text-text-muted">
              {progressPct}%
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label={`Onboarding progress: step ${step + 1} of ${TOTAL_STEPS}`}
            className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-surface-sunken ring-1 ring-inset ring-[--bezel-ring]"
          >
            {/*
              Progress fill animates `transform: scaleX()` (transform-origin
              left), not the layout `width` property — per the design system's
              "transform/opacity/shadow only" motion rule. The fill is full-width
              and scaled down; still `motion-safe:`-gated so reduced-motion users
              get an instant final state, and eased on the premium soft curve.
            */}
            <div
              className="h-full w-full origin-left rounded-pill bg-brand motion-safe:transition-transform motion-safe:duration-base motion-safe:ease-out-soft"
              style={{ transform: `scaleX(${progressPct / 100})` }}
            />
          </div>
        </div>
      </header>

      {/* Locale + unit controls — visible and changeable. */}
      <div className="mb-8 grid gap-5 rounded-lg border border-border bg-surface p-5 shadow-xs sm:grid-cols-2">
        <fieldset>
          <legend className="text-body-sm font-medium text-text">
            Factor set
          </legend>
          <div className="mt-2.5 flex gap-2">
            {(["US", "UK"] as const).map((l) => (
              <SegmentToggle
                key={l}
                pressed={locale === l}
                onClick={() => handleLocale(l)}
              >
                {l === "US" ? "US — EPA" : "UK — DEFRA/DESNZ"}
              </SegmentToggle>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-body-sm font-medium text-text">Units</legend>
          <div className="mt-2.5 flex gap-2">
            {(["imperial", "metric"] as const).map((u) => (
              <SegmentToggle
                key={u}
                pressed={unitSystem === u}
                onClick={() => handleUnitSystem(u)}
                className="capitalize"
              >
                {u}
              </SegmentToggle>
            ))}
          </div>
        </fieldset>
      </div>

      <Card elevation="raised" pad="none">
        <form
          aria-label={`Onboarding step ${step + 1}: ${STEP_TITLES[step]}`}
          onSubmit={(e) => e.preventDefault()}
          className="p-6 md:p-8"
        >
          {/*
            Focus target for step changes (WCAG 2.4.3). `tabIndex={-1}` makes it
            programmatically focusable without adding it to the tab order; on
            Next/Back we focus it so the user lands at the top of the new step.
            This wrapper stays mounted across step swaps; only its keyed child
            re-mounts, so focusing it always lands inside the current step.
          */}
          <div
            ref={stepHeadingRef}
            tabIndex={-1}
            className="focus:outline-none"
          >
            <m.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE_OUT_QUART }}
            >
              {step === 0 && (
                <StepHomeEnergy
                  unitSystem={unitSystem}
                  answers={answers}
                  unsure={unsure}
                  onAnswer={setAnswer}
                  onUnsure={setUnsureKey}
                />
              )}
              {step === 1 && (
                <StepTransport
                  unitSystem={unitSystem}
                  answers={answers}
                  unsure={unsure}
                  onAnswer={setAnswer}
                  onUnsure={setUnsureKey}
                />
              )}
              {step === 2 && (
                <StepDiet
                  answers={answers}
                  unsure={unsure}
                  onAnswer={setAnswer}
                  onUnsure={setUnsureKey}
                />
              )}
              {step === 3 && <StepReview items={items} locale={locale} />}
            </m.div>
          </div>

          <div className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {!isReview && (
              <Button size="sm" onClick={() => goTo(step + 1)}>
                Next
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

/**
 * A segmented pressed toggle for the factor-set / unit selectors. A real
 * <button> with `aria-pressed` (selection is exposed to AT, not color-only —
 * the pressed state also flips surface + text tone + a brand ring), ≥44px tall,
 * a visible focus ring, and a soft press handled at the Button-material level.
 */
function SegmentToggle({
  pressed,
  onClick,
  className = "",
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        "min-h-[44px] flex-1 rounded-sm border px-3 py-2 text-body-sm font-medium",
        "transition-colors duration-fast ease-out-quart",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]",
        "motion-safe:transition-[background-color,border-color,color,transform] motion-safe:active:scale-[0.98]",
        pressed
          ? "border-brand bg-surface-brand-subtle text-brand-fg"
          : "border-border-interactive bg-surface text-text-secondary hover:bg-surface-hover hover:text-text",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
