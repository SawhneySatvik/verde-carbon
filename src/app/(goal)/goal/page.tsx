"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { m } from "motion/react";
import type { Goal, Streak } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Button } from "../../_components/Button";
import { Card } from "../../_components/Card";
import { Field, Input } from "../../_components/Field";
import { AlertTriangle, Ripple, Target } from "../../_components/icons";
import { ConfirmDialog } from "./_components/ConfirmDialog";

/**
 * Goal — target + period form.
 *
 * Soft Structuralism: the form lives in a single Double-Bezel `Card` built from
 * the `Field` / `Input` primitives, the period is an accessible radio group of
 * pill controls, and the streak rule sits in its own resting card with a
 * Space-Grotesk display count. Tasteful `m`-driven reveals (transform/opacity
 * only, reduced-motion safe via the shared MotionProvider).
 *
 * PRESERVED (non-negotiable): clearing a goal opens a
 * focus-TRAPPED, Esc-dismissible `ConfirmDialog` that states what happens to the
 * data and returns focus to the opener on close; programmatic labels via `Field`;
 * validation focuses the first invalid field and NEVER clears the user's input;
 * ≥44px targets; visible focus. Save/clear go through `POST /api/goals`; changes
 * are announced via the live region.
 */

type Period = "weekly" | "monthly" | "yearly";

type Phase =
  | { kind: "loading" }
  | {
      kind: "ready";
      goal: Goal | null;
      streak: Streak | null;
    };

const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function GoalPage() {
  const { announce } = useAnnouncer();
  const reactId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [targetPct, setTargetPct] = useState("10");
  const [period, setPeriod] = useState<Period>("monthly");
  const [baselineKg, setBaselineKg] = useState("0");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const targetRef = useRef<HTMLInputElement | null>(null);
  const baselineRef = useRef<HTMLInputElement | null>(null);
  const targetId = `target-${reactId}`;

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      const res = await fetch("/api/goals", {
        headers: { accept: "application/json" },
      });
      const data = (await res.json()) as {
        goals: Goal[];
        streak: Streak | null;
      };
      const goal = data.goals.find((g) => g.active) ?? data.goals[0] ?? null;
      if (goal) {
        setTargetPct(String(goal.targetPct));
        setPeriod(goal.period);
        setBaselineKg(String(goal.baselineKg));
      }
      setPhase({ kind: "ready", goal, streak: data.streak ?? null });
    } catch {
      setStatusError("Couldn't load your goal. You can still set a new one.");
      setPhase({ kind: "ready", goal: null, streak: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function validate(): { targetPct: number; baselineKg: number } | null {
    const pct = Number(targetPct);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setFieldError("Enter a reduction target between 1 and 100 percent.");
      targetRef.current?.focus();
      return null;
    }
    const base = Number(baselineKg);
    if (!Number.isFinite(base) || base < 0) {
      setFieldError("Enter a baseline of zero or more kilograms.");
      baselineRef.current?.focus();
      return null;
    }
    setFieldError(null);
    return { targetPct: pct, baselineKg: base };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const valid = validate();
    if (!valid) {
      announce("Please fix the highlighted field.", "assertive");
      return;
    }
    setSaving(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: phase.kind === "ready" && phase.goal ? phase.goal.id : "goal-1",
          type: "reduction",
          targetPct: valid.targetPct,
          baselineKg: valid.baselineKg,
          period,
          active: true,
        }),
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      const data = (await res.json()) as { goal: Goal };
      announce(
        `Goal saved: ${valid.targetPct} percent reduction, ${period}.`,
        "assertive",
      );
      setPhase((prev) =>
        prev.kind === "ready" ? { ...prev, goal: data.goal } : prev,
      );
    } catch {
      setStatusError(
        "Saving your goal failed — your input is intact, try again.",
      );
      announce("Saving failed. Your input was kept.", "assertive");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearConfirmed() {
    setConfirmClear(false);
    if (phase.kind !== "ready" || !phase.goal) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: phase.goal.id,
          type: "reduction",
          targetPct: phase.goal.targetPct,
          baselineKg: phase.goal.baselineKg,
          period: phase.goal.period,
          active: false,
        }),
      });
      if (!res.ok) {
        throw new Error("clear failed");
      }
      announce("Goal cleared. You can set a new one anytime.", "assertive");
      setPhase((prev) =>
        prev.kind === "ready" ? { ...prev, goal: null } : prev,
      );
      setTargetPct("10");
      setPeriod("monthly");
    } catch {
      setStatusError("Clearing your goal failed — it's unchanged, try again.");
      announce("Clearing failed. Your goal is unchanged.", "assertive");
    } finally {
      setSaving(false);
    }
  }

  if (phase.kind === "loading") {
    return (
      <div className="mx-auto max-w-prose px-4 py-12 md:px-6 md:py-16">
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading your goal…</span>
          <div
            aria-hidden="true"
            className="rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring]"
          >
            <div className="h-72 rounded-bezel-inner bg-surface-sunken motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-4 py-12 md:px-6 md:py-16">
      <m.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.44, ease }}
        className="mb-10"
      >
        <Badge tone="brand" eyebrow icon={<Target size={13} />}>
          Stay on track
        </Badge>
        <h1 className="mt-3 text-balance font-display text-h1 text-text">
          {phase.goal ? "Your reduction goal" : "Set a reduction goal"}
        </h1>
        <p className="mt-3 max-w-[58ch] text-pretty text-body-lg text-text-secondary">
          Pick a reduction target and a period. Progress is measured against
          your baseline footprint — every figure stays sourced, never guessed.
        </p>
      </m.header>

      {statusError && (
        <p
          role="alert"
          className="mb-6 inline-flex items-start gap-2 rounded-md border border-danger/40 bg-danger-bg p-4 text-body-sm text-danger-fg"
        >
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {statusError}
        </p>
      )}

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.44, delay: 0.06, ease }}
      >
        <Card as="div" pad="lg">
          <form onSubmit={handleSave}>
            <div className="space-y-6">
              <Field
                id={targetId}
                label="Reduction target (percent vs baseline)"
                error={
                  fieldError ? (
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle
                        size={15}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                      {fieldError}
                    </span>
                  ) : undefined
                }
              >
                {(controlProps) => (
                  <div className="flex items-center gap-2.5">
                    <Input
                      {...controlProps}
                      ref={targetRef}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step="1"
                      value={targetPct}
                      onChange={(e) => setTargetPct(e.target.value)}
                      invalid={Boolean(fieldError)}
                      className="numeric w-28"
                    />
                    <span className="text-body text-text-secondary">
                      % reduction
                    </span>
                  </div>
                )}
              </Field>

              <fieldset>
                <legend className="text-body-sm font-medium text-text">
                  Period
                </legend>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {PERIODS.map((p) => (
                    <label
                      key={p.value}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-pill border border-border px-4 py-2.5 text-body-sm font-medium text-text-secondary transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text has-[:checked]:border-brand has-[:checked]:bg-surface-brand-subtle has-[:checked]:text-brand-fg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[--ring-offset]"
                    >
                      <input
                        type="radio"
                        name="period"
                        value={p.value}
                        checked={period === p.value}
                        onChange={() => setPeriod(p.value)}
                        className="h-4 w-4 border-border-interactive text-brand focus-visible:outline-none"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field
                id={`baseline-${reactId}`}
                label="Baseline footprint (kg CO₂e)"
                hint="Your starting point. Progress is measured against this."
              >
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    ref={baselineRef}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={baselineKg}
                    onChange={(e) => setBaselineKg(e.target.value)}
                    className="numeric w-44"
                  />
                )}
              </Field>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <Button type="submit" loading={saving}>
                {phase.goal ? "Update goal" : "Save goal"}
              </Button>
              {phase.goal && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmClear(true)}
                  disabled={saving}
                  className="text-danger-fg"
                >
                  Clear goal
                </Button>
              )}
            </div>
          </form>
        </Card>
      </m.div>

      <m.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.44, delay: 0.12, ease }}
        aria-labelledby={`streak-rule-${reactId}`}
        className="mt-6"
      >
        <Card as="div" pad="lg">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg"
            >
              <Ripple size={18} />
            </span>
            <h2
              id={`streak-rule-${reactId}`}
              className="font-display text-h3 text-text"
            >
              How your streak works
            </h2>
          </div>
          <p className="mt-4 flex items-baseline gap-2.5">
            <span className="numeric font-display text-display text-brand-active">
              {phase.streak?.count ?? 0}
            </span>
            <span className="font-display text-h3 text-text-muted">
              day{(phase.streak?.count ?? 0) === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-3 max-w-[60ch] text-pretty text-body text-text-secondary">
            Your streak counts each calendar day you log an activity, measured
            in your local time zone. Log on consecutive days and it grows; miss
            a full day and it restarts at one. We always show the change — a
            streak is never reset silently.
          </p>
        </Card>
      </m.section>

      {confirmClear && (
        <ConfirmDialog
          title="Clear your goal?"
          body="This deactivates your current reduction goal. Your logged activities and footprint history are NOT affected — only the goal and its progress tracking are removed. You can set a new goal anytime."
          confirmLabel="Clear goal"
          cancelLabel="Keep goal"
          destructive
          onConfirm={() => void handleClearConfirmed()}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
