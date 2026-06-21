"use client";

import * as React from "react";
import { m } from "motion/react";
import { FOCUS_RING } from "@/app/_lib/classNames";

/**
 * Badge + Chip — status / selection primitives.
 *
 * `Badge` is a static, non-interactive label (status, category, eyebrow). It is
 * pill-shaped, uses the AA-measured semantic *-bg / *-fg pairs, and pairs color
 * with TEXT (and an optional icon) so meaning is never color-only.
 *
 * `Chip` is the interactive, optionally selectable variant — a real <button>
 * with the full state matrix (default · hover · :focus-visible · active ·
 * disabled), `aria-pressed` when `selected` is controlled, a visible focus ring,
 * a ≥44px hit area (via padding + min-h on the touch surface), and a soft press.
 *
 * Tones map to the verified token pairs; `neutral` uses the sunken surface.
 */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-text-secondary",
  brand: "bg-surface-brand-subtle text-brand-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Render as an uppercase tracked eyebrow micro-label. */
  eyebrow?: boolean;
  /** Leading icon slot (decorative; the icon itself is aria-hidden). */
  icon?: React.ReactNode;
}

export function Badge({
  tone = "neutral",
  eyebrow = false,
  icon,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1",
        eyebrow
          ? "text-overline uppercase"
          : "text-caption font-medium leading-none",
        TONE_BADGE[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/* -------------------------------- Chip ---------------------------------- */

/** Same Motion/DOM handler-collision omission as Button (see Button.tsx). */
type SafeChipAttrs = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "style"
>;

export interface ChipProps extends SafeChipAttrs {
  tone?: Tone;
  /** Controlled selection → toggles `aria-pressed` + selected styling. */
  selected?: boolean;
  icon?: React.ReactNode;
}

const CHIP_SELECTED: Record<Tone, string> = {
  neutral: "border-border-interactive bg-surface-sunken text-text",
  brand: "border-brand bg-surface-brand-subtle text-brand-fg",
  success: "border-success bg-success-bg text-success-fg",
  warning: "border-warning bg-warning-bg text-warning-fg",
  danger: "border-danger bg-danger-bg text-danger-fg",
  info: "border-info bg-info-bg text-info-fg",
};

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  function Chip(
    {
      tone = "neutral",
      selected,
      icon,
      type = "button",
      disabled,
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <m.button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-pressed={selected === undefined ? undefined : selected}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        className={[
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border px-4 py-2",
          "text-body-sm font-medium leading-none",
          "transition-colors duration-fast ease-out-quart",
          FOCUS_RING,
          "disabled:cursor-not-allowed disabled:opacity-60",
          selected
            ? CHIP_SELECTED[tone]
            : "border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {icon ? (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {icon}
          </span>
        ) : null}
        {children}
      </m.button>
    );
  },
);
