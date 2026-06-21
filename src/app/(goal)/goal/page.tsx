"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import type { Goal, Streak } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { AlertTriangle, Target } from "../../_components/icons";
import { ConfirmDialog } from "./_components/ConfirmDialog";
import { GoalForm } from "./_components/GoalForm";
import { StreakExplainer } from "./_components/StreakExplainer";

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
  const baselineId = `baseline-${reactId}`;

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
        transition={{ duration: 0.44, ease: EASE_OUT_QUART }}
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
        transition={{ duration: 0.44, delay: 0.06, ease: EASE_OUT_QUART }}
      >
        <GoalForm
          hasGoal={Boolean(phase.goal)}
          targetId={targetId}
          baselineId={baselineId}
          targetPct={targetPct}
          period={period}
          baselineKg={baselineKg}
          fieldError={fieldError}
          saving={saving}
          targetRef={targetRef}
          baselineRef={baselineRef}
          onTargetPctChange={setTargetPct}
          onPeriodChange={setPeriod}
          onBaselineKgChange={setBaselineKg}
          onSave={handleSave}
          onClear={() => setConfirmClear(true)}
        />
      </m.div>

      <m.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.44, delay: 0.12, ease: EASE_OUT_QUART }}
        aria-labelledby={`streak-rule-${reactId}`}
        className="mt-6"
      >
        <StreakExplainer
          count={phase.streak?.count ?? 0}
          headingId={`streak-rule-${reactId}`}
        />
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
