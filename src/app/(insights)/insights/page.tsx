"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Button } from "../../_components/Button";
import { ChartLine } from "../../_components/icons";
import { EmptyInsights } from "./_components/EmptyInsights";
import { InsightCard } from "./_components/InsightCard";
import { InsightsError } from "./_components/InsightsError";
import { InsightsSkeleton } from "./_components/InsightsSkeleton";
import { SkippedSection } from "./_components/SkippedSection";
import type { Insight, SkippedCandidate } from "./_components/types";

/**
 * Insights — ranked reduction list.
 *
 * Soft Structuralism: each ranked reduction is its own resting Double-Bezel
 * `Card`, opening with a big Space-Grotesk numbered rank index, a category icon,
 * the calculator-sourced projected saving in tabular Geist-Mono inside a success
 * `Badge`, the phrased action, a now→after comparison, the factor-source link,
 * and a CTA to log it. Tiles reveal with a tasteful `m`-driven stagger
 * (transform/opacity only, reduced-motion safe via the shared MotionProvider's
 * `MotionConfig reducedMotion="user"`); content is visible by default.
 *
 * PRESERVED (non-negotiable): every quantified saving comes from
 * `GET /api/insights`, derived from the PURE calculator (ADR-001) — the model
 * only phrases. The list is a real semantic <ol> and the RANK is stated IN TEXT
 * ("#1 highest impact"), never by position/colour alone. Empty /
 * loading / error states all render; loading/error refs + aria-live preserved.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; insights: Insight[]; skipped: SkippedCandidate[] };

export default function InsightsPage() {
  const { announce } = useAnnouncer();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    announce("Loading your insights…");
    try {
      const res = await fetch("/api/insights", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error("fetch failed");
      }
      const data = (await res.json()) as {
        insights: Insight[];
        skipped: SkippedCandidate[];
      };
      announce(
        data.insights.length === 0
          ? "No personalised insights yet."
          : `${data.insights.length} ranked insight${data.insights.length === 1 ? "" : "s"} ready.`,
      );
      setPhase({
        kind: "ready",
        insights: data.insights,
        skipped: data.skipped ?? [],
      });
    } catch {
      announce("We couldn't load your insights. Try again.", "assertive");
      setPhase({ kind: "error" });
    }
  }, [announce]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase.kind === "error") {
      errorRef.current?.focus();
    }
  }, [phase.kind]);

  return (
    <div className="mx-auto max-w-prose px-4 py-12 md:px-6 md:py-16">
      <header className="mb-10">
        <Badge tone="brand" eyebrow icon={<ChartLine size={13} />}>
          Reduce your footprint
        </Badge>
        <h1 className="mt-3 text-balance font-display text-h1 text-text">
          Ranked insights
        </h1>
        <p className="mt-3 max-w-[58ch] text-pretty text-body-lg text-text-secondary">
          Derived from your own logged activities. Every projected saving is
          computed by our calculator from published factors — the wording is the
          only thing AI touches.
        </p>
      </header>

      {phase.kind === "loading" && <InsightsSkeleton />}

      {phase.kind === "error" && (
        <InsightsError errorRef={errorRef} onRetry={() => void load()} />
      )}

      {phase.kind === "ready" && phase.insights.length === 0 && (
        <EmptyInsights />
      )}

      {phase.kind === "ready" && phase.insights.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-text-muted" role="status">
              {phase.insights.length} insight
              {phase.insights.length === 1 ? "" : "s"}, ranked by impact.
            </p>
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          <ol className="space-y-5">
            {phase.insights.map((insight, i) => (
              <m.li
                key={insight.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.44,
                  delay: 0.06 * i,
                  ease: EASE_OUT_QUART,
                }}
              >
                <InsightCard insight={insight} />
              </m.li>
            ))}
          </ol>

          {phase.skipped.length > 0 && (
            <SkippedSection skipped={phase.skipped} />
          )}
        </>
      )}
    </div>
  );
}
