"use client";

import { useId, useState } from "react";
import { m } from "motion/react";
import type { FactorSet, UnitSystem } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Card } from "../../_components/Card";
import { Badge } from "../../_components/Badge";
import { InfoCircle, Settings as SettingsIcon } from "../../_components/icons";

/**
 * Settings.
 *
 * Factor-set and unit toggles, built on the Double-Bezel `Card` material with
 * the segmented-control look (native radios styled as a segmented control for
 * the unit picker; rich labelled radio rows for the factor set). The icon set
 * replaces the emoji/Unicode glyphs (ℹ → InfoCircle), and the surface reveals
 * with a tasteful `m`-driven stagger (transform/opacity only, reduced-motion safe
 * via the shared MotionProvider's `MotionConfig reducedMotion="user"`).
 *
 * PRESERVED (non-negotiable):
 *  - Each control group is a real <fieldset>/<legend> → `role="group"` with the
 *    legend as its accessible name; options are native <input type="radio"> with
 *    real labels (programmatic labels, ≥44px targets, visible focus).
 *  - Every change ANNOUNCES the recompute via the live region with the
 *    provenance-correct wording.
 *  - Switching the factor set applies to NEW logs ONLY and does NOT
 *    recompute historical entries; each stored activity keeps its original
 *    `co2eKg` AND `factorSetVersion` provenance, so "click to source" on any past
 *    entry stays truthful. The UI states this explicitly (a single <p>).
 *  - Switching units converts displays in place (round-trip-safe), non-destructive
 *    — it changes no stored number.
 */

const FACTOR_SETS: ReadonlyArray<{
  value: FactorSet;
  label: string;
  sub: string;
}> = [
  {
    value: "EPA",
    label: "EPA (United States)",
    sub: "US EPA GHG Emission Factors Hub",
  },
  {
    value: "DEFRA_DESNZ",
    label: "DEFRA / DESNZ (United Kingdom)",
    sub: "UK Government GHG conversion factors",
  },
];

const UNIT_SYSTEMS: ReadonlyArray<{
  value: UnitSystem;
  label: string;
  sub: string;
}> = [
  { value: "metric", label: "Metric", sub: "km, litres, kg" },
  { value: "imperial", label: "Imperial", sub: "miles, gallons, lb" },
];

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};
const ease = [0.16, 1, 0.3, 1] as const;

export default function SettingsPage() {
  const { announce } = useAnnouncer();
  const reactId = useId();
  const [factorSet, setFactorSet] = useState<FactorSet>("EPA");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");

  function changeFactorSet(next: FactorSet) {
    if (next === factorSet) {
      return;
    }
    setFactorSet(next);
    const label =
      next === "EPA" ? "EPA (United States)" : "DEFRA/DESNZ (United Kingdom)";
    announce(
      `Factor set changed to ${label}. New logs will use it; your past entries keep their original figures and sources.`,
      "assertive",
    );
  }

  function changeUnitSystem(next: UnitSystem) {
    if (next === unitSystem) {
      return;
    }
    setUnitSystem(next);
    announce(
      `Units changed to ${next}. Displayed amounts are converted in place — no data is lost.`,
      "assertive",
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">
      <m.header
        {...reveal}
        transition={{ duration: 0.48, ease }}
        className="mb-10"
      >
        <Badge tone="brand" eyebrow icon={<SettingsIcon size={13} />}>
          Preferences
        </Badge>
        <h1 className="mt-4 text-balance font-display text-h1 text-text">
          Settings
        </h1>
        <p className="mt-4 max-w-[58ch] text-pretty text-body-lg text-text-secondary">
          Override the defaults detected from your locale. Changes are
          non-destructive — you never lose what you&rsquo;ve entered.
        </p>
      </m.header>

      <form className="space-y-6">
        {/* ── Emission factor set ── */}
        <m.div {...reveal} transition={{ duration: 0.48, delay: 0.06, ease }}>
          <Card as="div" pad="lg">
            <fieldset>
              <legend className="text-h4 text-text">Emission factor set</legend>
              <p className="mt-1 text-body-sm text-text-secondary">
                Which published dataset prices your activities.
              </p>
              <div className="mt-4 grid gap-3">
                {FACTOR_SETS.map((fs) => {
                  const checked = factorSet === fs.value;
                  return (
                    <label
                      key={fs.value}
                      className={[
                        "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-4",
                        "transition-colors duration-fast ease-out-quart",
                        checked
                          ? "border-brand bg-surface-brand-subtle"
                          : "border-border-interactive bg-surface hover:bg-surface-hover",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="factorSet"
                        value={fs.value}
                        checked={checked}
                        onChange={() => changeFactorSet(fs.value)}
                        className="mt-1 h-4 w-4 shrink-0 border-border-interactive text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                      />
                      <span className="min-w-0">
                        <span
                          className={[
                            "block text-body font-medium",
                            checked ? "text-brand-fg" : "text-text",
                          ].join(" ")}
                        >
                          {fs.label}
                        </span>
                        <span className="mt-0.5 block text-body-sm text-text-muted">
                          {fs.sub}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Pinned provenance statement, visible in the UI (single <p>). */}
            <p
              id={`factorset-note-${reactId}`}
              className="mt-5 flex items-start gap-2.5 rounded-lg bg-info-bg p-4 text-body-sm text-info-fg"
            >
              <InfoCircle
                size={20}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Switching the factor set applies to{" "}
                <strong>new logs only</strong>. Your existing entries are{" "}
                <strong>not</strong> recomputed — each one keeps the exact CO₂e
                and source it was logged with, so &ldquo;click to source&rdquo;
                on any past activity always shows the figure you actually
                recorded.
              </span>
            </p>
          </Card>
        </m.div>

        {/* ── Units (segmented control) ── */}
        <m.div {...reveal} transition={{ duration: 0.48, delay: 0.12, ease }}>
          <Card as="div" pad="lg">
            <fieldset>
              <legend className="text-h4 text-text">Units</legend>
              <p className="mt-1 text-body-sm text-text-secondary">
                How distances, volumes and weights are shown and entered.
              </p>

              {/* Segmented control — native radios styled as a connected group;
                  the selected segment lifts onto the brand-subtle surface. */}
              <div
                role="presentation"
                className="mt-4 grid gap-1.5 rounded-lg bg-surface-sunken p-1.5 sm:grid-cols-2"
              >
                {UNIT_SYSTEMS.map((u) => {
                  const checked = unitSystem === u.value;
                  return (
                    <label
                      key={u.value}
                      className={[
                        "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-4 py-3",
                        "transition-colors duration-fast ease-out-quart",
                        checked
                          ? "bg-surface text-text shadow-xs ring-1 ring-brand/40"
                          : "text-text-secondary hover:bg-surface-hover hover:text-text",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="unitSystem"
                        value={u.value}
                        checked={checked}
                        onChange={() => changeUnitSystem(u.value)}
                        className="h-4 w-4 shrink-0 border-border-interactive text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                      />
                      <span className="min-w-0">
                        <span className="block text-body font-medium">
                          {u.label}
                        </span>
                        <span className="mt-0.5 block text-caption text-text-muted">
                          {u.sub}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <p className="mt-5 text-body-sm text-text-secondary">
              Changing units converts what&rsquo;s on screen in place — your
              stored values are unchanged and round-trip exactly.
            </p>
          </Card>
        </m.div>

        {/* ── Motion (honours the OS preference automatically) ── */}
        <m.section
          {...reveal}
          transition={{ duration: 0.48, delay: 0.18, ease }}
          aria-labelledby={`motion-${reactId}`}
        >
          <Card as="div" pad="lg">
            <h2 id={`motion-${reactId}`} className="text-h4 text-text">
              Motion
            </h2>
            <p className="mt-2 max-w-[62ch] text-body-sm text-text-secondary">
              Verdé honours your system &ldquo;reduce motion&rdquo; setting
              automatically — chart and transition animations are turned off
              when you&rsquo;ve asked your device to reduce motion.
              There&rsquo;s nothing to toggle here. Switch the app&rsquo;s
              light, dark, or system theme from the toggle in the header.
            </p>
          </Card>
        </m.section>
      </form>
    </div>
  );
}
