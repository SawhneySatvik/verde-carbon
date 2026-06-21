"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Activity, Goal, Streak } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Ripple } from "../../_components/icons";
import { SAMPLE_ID_PREFIX } from "@/app/api/dev/seed/sampleTag";
import { localeDayKey } from "@/server/http/day";
import { ReadyDashboard } from "./_components/ReadyDashboard";
import {
  DashboardError,
  DashboardSkeleton,
  EmptyDashboard,
} from "./_components/DashboardStates";

/**
 * Dashboard.
 *
 * Soft Structuralism × Asymmetrical Bento: a masonry of varying tile sizes where
 * a DOMINANT hero footprint tile (raised, brand-washed, Space-Grotesk display
 * number / Geist-Mono tabular digits) anchors the grid, with lighter secondary
 * tiles (streak, goal ring, top recommendation) and full-width chart tiles. Every
 * tile is the Double-Bezel `Card` material; the hero is the only `elevation="raised"`
 * tile so the elevation hierarchy reads at a glance. Tiles reveal with a tasteful
 * `m`-driven stagger (transform/opacity only, reduced-motion safe via the shared
 * MotionProvider's `MotionConfig reducedMotion="user"`); content is visible by
 * default — the reveal only enhances.
 *
 * PRESERVED (non-negotiable): the charts' non-colour encoding + keyboard-reachable
 * data-table fallbacks + text summaries; the "show the math" provenance (reads each
 * activity's STORED `co2eKg`/`factorSet`); the locale-day trend bucketing; the
 * focus-on-ready / focus-on-error refs + `tabIndex={-1}` targets; aria-live; heading
 * order; ≥44px targets. None of this touches the a11y model.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      activities: Activity[];
      goal: Goal | null;
      streak: Streak | null;
    };

/**
 * The display surface must never crash on an exotic/aliased IANA zone (some
 * runtimes resolve, e.g., "Asia/Calcutta" which strict `localeDayKey` rejects).
 * Probe the resolved zone once and fall back to UTC if it isn't usable, so the
 * dashboard degrades to UTC bucketing rather than a dead screen.
 */
function resolveTimeZone(): string {
  let zone = "UTC";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
  try {
    localeDayKey(new Date(), zone);
    return zone;
  } catch {
    return "UTC";
  }
}

export default function DashboardPage() {
  const { announce } = useAnnouncer();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [showMath, setShowMath] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const reactId = useId();
  const timeZone = resolveTimeZone();

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    announce("Loading your dashboard…");
    try {
      const [actRes, goalsRes] = await Promise.all([
        fetch("/api/activities", { headers: { accept: "application/json" } }),
        fetch("/api/goals", { headers: { accept: "application/json" } }),
      ]);
      if (!actRes.ok || !goalsRes.ok) {
        throw new Error("fetch failed");
      }
      const actData = (await actRes.json()) as { activities: Activity[] };
      const goalsData = (await goalsRes.json()) as {
        goals: Goal[];
        streak: Streak | null;
      };
      const goal =
        goalsData.goals.find((g) => g.active) ?? goalsData.goals[0] ?? null;
      announce("Dashboard ready.");
      setPhase({
        kind: "ready",
        activities: actData.activities,
        goal,
        streak: goalsData.streak ?? null,
      });
    } catch {
      announce("We couldn't load your dashboard. Try again.", "assertive");
      setPhase({ kind: "error" });
    }
  }, [announce]);

  // Demo affordance: seed/clear the user's OWN anon account with sample data whose
  // CO2e is computed by the same calculator real logging uses (never fabricated),
  // then reload so the populated dashboard renders. Announced for SR users.
  const loadSample = useCallback(async () => {
    setSampleBusy(true);
    announce("Loading sample data…");
    try {
      const res = await fetch("/api/dev/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        throw new Error("seed failed");
      }
      announce("Sample data loaded. Showing your populated dashboard.");
      await load();
    } catch {
      announce("We couldn't load the sample data. Try again.", "assertive");
    } finally {
      setSampleBusy(false);
    }
  }, [announce, load]);

  const clearSample = useCallback(async () => {
    setSampleBusy(true);
    announce("Clearing sample data…");
    try {
      const res = await fetch("/api/dev/seed", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("clear failed");
      }
      announce("Sample data cleared.");
      await load();
    } catch {
      announce("We couldn't clear the sample data. Try again.", "assertive");
    } finally {
      setSampleBusy(false);
    }
  }, [announce, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase.kind === "error") {
      errorRef.current?.focus();
    }
  }, [phase.kind]);

  return (
    <div className="mx-auto max-w-app px-4 py-12 md:px-6 md:py-16 lg:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge tone="brand" eyebrow icon={<Ripple size={13} />}>
            Your footprint
          </Badge>
          <h1 className="mt-3 text-balance font-display text-h1 text-text">
            Dashboard
          </h1>
        </div>
      </header>

      {phase.kind === "loading" && <DashboardSkeleton />}

      {phase.kind === "error" && (
        <DashboardError errorRef={errorRef} onRetry={() => void load()} />
      )}

      {phase.kind === "ready" && phase.activities.length === 0 && (
        <EmptyDashboard
          streak={phase.streak}
          onLoadSample={() => void loadSample()}
          sampleBusy={sampleBusy}
        />
      )}

      {phase.kind === "ready" && phase.activities.length > 0 && (
        <ReadyDashboard
          activities={phase.activities}
          goal={phase.goal}
          streak={phase.streak}
          timeZone={timeZone}
          showMath={showMath}
          onToggleMath={() => setShowMath((v) => !v)}
          mathPanelId={`total-math-${reactId}`}
          hasSampleData={phase.activities.some((a) =>
            a.id.startsWith(SAMPLE_ID_PREFIX),
          )}
          onClearSample={() => void clearSample()}
          sampleBusy={sampleBusy}
        />
      )}
    </div>
  );
}
