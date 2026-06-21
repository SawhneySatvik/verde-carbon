"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import type { Locale, Unit } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Tabs } from "../../_components/Tabs";
import { Lock, PlusLog, Ripple } from "../../_components/icons";
import { ParseConfirmation } from "./_components/ParseConfirmation";
import { ImageLogger } from "./_components/ImageLogger";
import { TextEntry } from "./_components/TextEntry";
import { FallbackSection } from "./_components/FallbackSection";
import { SavedConfirmation } from "./_components/SavedConfirmation";

/**
 * Log Activity. The load-bearing "show before save" surface.
 *
 * Flow:
 *   idle → (submit NL) → parsing → confirm (ParseConfirmation) → (Log it) → saved
 *   idle → (snap/sample photo) → parsing → confirm (ParseConfirmation) → saved
 *   any AI failure / "use structured" → fallback (FallbackForm) → confirm → saved
 *
 * The entry surface is a two-tab switch ("Describe it" = the NL textarea,
 * "Snap a photo" = ImageLogger). BOTH paths feed the SAME `confirm` phase +
 * ParseConfirmation + `saved` flow — ParseConfirmation is never duplicated, and
 * the zero-writes-until-"Log it" contract + phase-change focus management apply
 * identically to text and image entries.
 *
 * Persistence contract: the ONLY write happens in `handleConfirm`, which
 * POSTs to /api/activities WITHOUT ?preview — and only after the user clicks
 * "Log it". The parse step and the preview compute never persist. A component
 * test asserts zero non-preview POSTs until confirm.
 *
 * Look (Soft Structuralism): a large, inviting NL input surface wrapped in the
 * Double-Bezel `Card`, macro-whitespace, tabular CO₂e figures downstream, and a
 * "measured, not guessed" honesty note. Tasteful entrance motion via `m` (under
 * the shared LazyMotion provider; transform/opacity only → reduced-motion safe
 * through MotionConfig reducedMotion="user"). All focus management, refs,
 * announcements, ≥44px targets, and test hooks are preserved verbatim.
 */

interface ParsedItem {
  activity: string;
  value: number;
  unit: Unit;
  candidateFactorKey: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "confirm"; items: ParsedItem[]; saving: boolean }
  | { kind: "fallback"; reason?: string }
  | { kind: "saved"; totalKg: number; partial: boolean };

const LOCALE: Locale = "US";

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

type EntryMode = "text" | "image";

export default function LogPage() {
  const { announce } = useAnnouncer();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<EntryMode>("text");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Focus targets for the phase transitions (WCAG 2.4.3 Focus Order). On each
  // phase change the now-active control replaces or disables the prior one, so
  // we move focus to the heading/message of the new phase (focus + announce
  // together) — mirroring dashboard/insights/link's focus-on-change pattern.
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (phase.kind === "fallback") {
      // Parse failed into the structured fallback — land on the explanation.
      // The fallback <p> only renders when there's a reason; if there's none,
      // `errorRef.current` is null and `?.focus()` is a no-op (focus stays on
      // the "Use the structured form" control the user clicked).
      errorRef.current?.focus();
    } else if (phase.kind === "confirm") {
      confirmHeadingRef.current?.focus();
    } else if (phase.kind === "saved") {
      savedHeadingRef.current?.focus();
    }
  }, [phase.kind]);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() === "") {
      return;
    }
    setPhase({ kind: "parsing" });
    announce("Parsing your activity…");

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text, locale: LOCALE }),
      });
      const data = (await res.json()) as
        | {
            fallback: false;
            parse: { items: ParsedItem[]; clarification?: string };
          }
        | { fallback: true; reason: string; message: string };

      if (data.fallback) {
        announce(
          "We couldn't parse that automatically. Use the structured form instead.",
          "assertive",
        );
        setPhase({ kind: "fallback", reason: data.message });
        return;
      }

      if (data.parse.items.length === 0) {
        announce(
          data.parse.clarification ??
            "No activity was recognised. Try the structured form.",
          "assertive",
        );
        setPhase({ kind: "fallback", reason: data.parse.clarification });
        return;
      }

      announce(
        `Parsed ${data.parse.items.length} item${data.parse.items.length === 1 ? "" : "s"}. Review the breakdown before saving.`,
      );
      setPhase({ kind: "confirm", items: data.parse.items, saving: false });
    } catch {
      announce(
        "The parser is unavailable. Use the structured form to keep logging.",
        "assertive",
      );
      setPhase({ kind: "fallback" });
    }
  }

  // The image path (ImageLogger) does its own /api/parse-image fetch + parsing
  // display, then hands the SAME shape of parsed items here so the confirm phase
  // is shared verbatim with the NL path (ParseConfirmation is never duplicated).
  // ImageLogger never persists; these only move the phase machine forward, and
  // the phase-change effect handles focus exactly as it does for text.
  function handleImageParsed(items: ParsedItem[]) {
    setPhase({ kind: "confirm", items, saving: false });
  }

  // A non-blocking image fallback (AI fallback signal or 413 oversize): drop to
  // the structured form with the reason, like the NL fallback. ImageLogger keeps
  // its own preview so the user can also just retry a different photo.
  function handleImageFallback(reason: string) {
    setPhase({ kind: "fallback", reason });
  }

  // The ONLY persistence path. Runs solely on "Log it" — never during parse or
  // preview ("show before save").
  async function handleConfirm(items: readonly ParsedItem[]) {
    setPhase((prev) =>
      prev.kind === "confirm" ? { ...prev, saving: true } : prev,
    );
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            category: categoryForKey(it.candidateFactorKey),
            activity: it.activity,
            value: it.value,
            unit: it.unit,
            candidateFactorKey: it.candidateFactorKey,
          })),
          locale: LOCALE,
          origin: "nl",
        }),
      });
      const data = (await res.json()) as {
        totalKg: number;
        partial: boolean;
      };
      announce(
        `Logged — added to your dashboard. ${data.totalKg.toFixed(2)} kilograms CO2e.`,
        "assertive",
      );
      setPhase({ kind: "saved", totalKg: data.totalKg, partial: data.partial });
    } catch {
      announce(
        "Saving failed. Your entry was not lost — try again.",
        "assertive",
      );
      setPhase((prev) =>
        prev.kind === "confirm" ? { ...prev, saving: false } : prev,
      );
    }
  }

  function reset() {
    setText("");
    setPhase({ kind: "idle" });
  }

  const isEntry = phase.kind === "idle" || phase.kind === "parsing";

  return (
    <div className="mx-auto max-w-prose px-4 py-16 md:px-6 md:py-24">
      <m.header
        {...reveal}
        transition={{ duration: 0.44, ease: EASE_OUT_QUART }}
        className="mb-8"
      >
        <Badge tone="brand" eyebrow icon={<Ripple size={13} />}>
          Log an activity
        </Badge>
        <h1 className="mt-4 text-balance font-display text-h1 tracking-[-0.015em] text-text">
          What did you do?
        </h1>
        <p className="mt-3 max-w-[54ch] text-pretty text-body-lg text-text-secondary">
          Describe it in plain language or snap a photo. You&rsquo;ll see the
          parsed items, the computed CO₂e, and the published source before
          anything is saved.
        </p>
      </m.header>

      {/* Entry surface — a two-tab switch. Both tabs feed the SAME confirm /
          saved flow below; the structured fallback is reachable from either. */}
      {isEntry && (
        <m.div
          {...reveal}
          transition={{ duration: 0.48, delay: 0.06, ease: EASE_OUT_QUART }}
        >
          <Tabs
            label="Choose how to log your activity"
            idBase="log-mode"
            value={mode}
            onValueChange={(v) => setMode(v as EntryMode)}
            items={[
              {
                value: "text",
                label: "Describe it",
                icon: <Ripple size={15} />,
              },
              {
                value: "image",
                label: "Snap a photo",
                icon: <PlusLog size={15} />,
              },
            ]}
          >
            {(active) =>
              active === "text" ? (
                <TextEntry
                  text={text}
                  onTextChange={setText}
                  parsing={phase.kind === "parsing"}
                  onParse={handleParse}
                  onUseStructured={() => setPhase({ kind: "fallback" })}
                />
              ) : (
                <ImageLogger
                  locale={LOCALE}
                  onParsed={handleImageParsed}
                  onFallback={handleImageFallback}
                />
              )
            }
          </Tabs>

          {/* Honesty note — shared by both entry modes. Green stays a minor
              accent. */}
          <p className="mt-5 inline-flex items-center gap-2 text-body-sm text-text-muted">
            <Lock
              size={15}
              className="shrink-0 text-text-muted"
              aria-hidden="true"
            />
            Nothing is saved until you review the breakdown and confirm.
          </p>
        </m.div>
      )}

      {phase.kind === "fallback" && (
        <FallbackSection
          reason={phase.reason}
          errorRef={errorRef}
          onSubmit={(items) =>
            setPhase({ kind: "confirm", items: [...items], saving: false })
          }
          onCancel={reset}
        />
      )}

      {phase.kind === "confirm" && (
        <ParseConfirmation
          parsedItems={phase.items}
          locale={LOCALE}
          saving={phase.saving}
          onConfirm={handleConfirm}
          onCancel={reset}
          headingRef={confirmHeadingRef}
        />
      )}

      {phase.kind === "saved" && (
        <SavedConfirmation
          totalKg={phase.totalKg}
          partial={phase.partial}
          headingRef={savedHeadingRef}
          onReset={reset}
        />
      )}
    </div>
  );
}

/**
 * Map a seeded factor key to its category for the activities POST. Mirrors the
 * key prefixes in the seed; unknown keys default to "transport" (the server
 * re-validates the key and excludes anything unsourced anyway).
 */
function categoryForKey(key: string): "transport" | "energy" | "diet" {
  if (key.startsWith("energy.")) return "energy";
  if (key.startsWith("diet.")) return "diet";
  return "transport";
}
