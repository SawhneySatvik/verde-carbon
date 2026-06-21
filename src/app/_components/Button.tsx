"use client";

import * as React from "react";
import { m } from "motion/react";
import { PRESS_SPRING } from "@/app/_lib/motion";

/**
 * Button — interactive primitive with "button-in-button" and magnetic press
 * physics.
 *
 * Variants: primary / secondary / ghost. Each carries the full state matrix —
 * default · hover · :focus-visible · active · disabled · loading — with a visible
 * focus ring, a ≥44px target, and a soft spring press (scale via the `m` layer
 * under the shared LazyMotion provider; transform-only, so it is reduced-motion
 * safe automatically through `MotionConfig reducedMotion="user"`).
 *
 * Button-in-button: pass `trailingIcon` (e.g. <ArrowUpRight />) and it is nested
 * in its own circular "island" wrapper flush with the right padding, which
 * translates diagonally on hover for internal kinetic tension.
 * `leadingIcon` renders a plain inline slot.
 *
 * Accessibility:
 *  - real <button> (or, opt-in, any element via `render`) — keyboard/AT native.
 *  - `loading` sets `aria-busy` and disables the control; the spinner is
 *    `aria-hidden` and we keep an accessible label (visible text stays in DOM,
 *    just visually swapped — never removed, so the name is stable).
 *  - icons are `aria-hidden` by default (passed through from the icon set); an
 *    icon-only button MUST be given an `aria-label` by the caller.
 */

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 " +
  "rounded-sm font-medium leading-none " +
  "transition-colors duration-fast ease-out-quart " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-brand text-text-onbrand shadow-xs " +
    "hover:bg-brand-hover disabled:bg-brand",
  secondary:
    "border border-border-interactive bg-surface text-text " +
    "hover:bg-surface-hover disabled:bg-surface",
  ghost:
    "bg-transparent text-text-secondary " +
    "hover:bg-surface-hover hover:text-text disabled:bg-transparent",
};

// ≥44px targets on both sizes (sm pads to 44, md to 48 via min-h).
const SIZE: Record<Size, string> = {
  sm: "min-h-[44px] px-4 py-2 text-body-sm",
  md: "min-h-[48px] px-6 py-3 text-body",
};

/** The nested circular "island" that holds a trailing CTA icon. */
const TRAILING_ISLAND: Record<Variant, string> = {
  primary: "bg-[rgba(255,255,255,0.16)]",
  secondary: "bg-[--surface-sunken]",
  ghost: "bg-[--surface-sunken]",
};

/**
 * Native drag / animation DOM handlers collide with Motion's same-named props,
 * so we omit them from the public surface (a button never needs them) — every
 * other button attribute (onClick, aria-*, form, name, value, …) stays.
 */
type SafeButtonAttrs = Omit<
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

export interface ButtonProps extends SafeButtonAttrs {
  variant?: Variant;
  size?: Size;
  /** Show a spinner, disable the button, set aria-busy. */
  loading?: boolean;
  /** Plain leading icon slot (decorative; aria-hidden by the icon itself). */
  leadingIcon?: React.ReactNode;
  /** Trailing CTA icon — nested in its own "island" circle (button-in-button). */
  trailingIcon?: React.ReactNode;
  /** Stretch to container width. */
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leadingIcon,
      trailingIcon,
      fullWidth = false,
      disabled,
      type = "button",
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <m.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        // Soft spring press — transform only; honored by reducedMotion="user".
        whileTap={isDisabled ? undefined : { scale: 0.97 }}
        transition={PRESS_SPRING}
        className={[
          BASE,
          VARIANT[variant],
          SIZE[size],
          fullWidth ? "w-full" : "",
          // group enables the trailing-island hover translate
          "group",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {/* Spinner overlays without removing the label (stable accessible name). */}
        {loading ? (
          <span
            aria-hidden="true"
            className="absolute inline-flex h-4 w-4 motion-safe:animate-spin"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2.5"
                opacity="0.25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        ) : null}

        <span
          className={[
            "inline-flex items-center gap-2",
            loading ? "invisible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {leadingIcon ? (
            <span aria-hidden="true" className="inline-flex shrink-0">
              {leadingIcon}
            </span>
          ) : null}
          {children}
          {trailingIcon ? (
            <span
              aria-hidden="true"
              className={[
                "ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill",
                TRAILING_ISLAND[variant],
                "transition-transform duration-fast ease-out-soft",
                "motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5",
              ].join(" ")}
            >
              {trailingIcon}
            </span>
          ) : null}
        </span>
      </m.button>
    );
  },
);
