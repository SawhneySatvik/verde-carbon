"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "./icons";

/**
 * ThemeToggle — cycles light → dark → system. Deliberately avoids the default
 * sun/moon *switch* — this is a labelled cycle button that also exposes
 * "system/auto" as a first-class state.
 *
 * SSR-safe: theme is unknown on the server, so until mounted we render a stable
 * placeholder with the same dimensions (no layout shift, no hydration mismatch).
 * The button is fully keyboard-operable, ≥44px target, with a focus-visible ring
 * and an `aria-label` that names BOTH the current state and the next action.
 *
 * Phase B places this in the app shell header; exposed here so it's ready.
 */

const ORDER = ["light", "dark", "system"] as const;
type Choice = (typeof ORDER)[number];

const NEXT_LABEL: Record<Choice, string> = {
  light: "Theme: light. Switch to dark.",
  dark: "Theme: dark. Switch to system.",
  system: "Theme: system. Switch to light.",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const base =
    "inline-flex h-11 w-11 items-center justify-center rounded-lg border " +
    "border-border bg-surface text-text-secondary " +
    "transition-colors duration-fast ease-out-quart " +
    "hover:bg-surface-hover hover:text-text " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] " +
    className;

  if (!mounted) {
    // Stable placeholder: same box, no icon, inert to AT until hydrated.
    return <span aria-hidden="true" className={base.replace("hover:", "")} />;
  }

  const current = (
    ORDER.includes(theme as Choice) ? (theme as Choice) : "system"
  ) as Choice;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={NEXT_LABEL[current]}
      title={NEXT_LABEL[current]}
      className={base}
    >
      <Icon size={20} />
    </button>
  );
}
