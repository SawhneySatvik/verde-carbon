import * as React from "react";

/**
 * Card — the "Double-Bezel" material.
 *
 * A premium card never sits flatly on the background; it reads like a glass plate
 * in a machined tray:
 *  - OUTER SHELL: `--bezel-shell` tint + a `--bezel-ring` hairline ring, 6px of
 *    padding (the bezel gap), radius `--radius-2xl` (24px).
 *  - INNER CORE: `--surface` (or `--surface-raised` when floating), an inner top
 *    highlight (`shadow-bezel-inner`), radius `--radius-bezel-inner` (18px =
 *    24px − 6px) → mathematically concentric curves.
 *
 * Guard (anti "ghost-card"): the inner core separates from the shell with a soft
 * shadow OR a hairline — never a 1px border + ≥16px blur on the same element. We
 * use the bezel ring + inner highlight, no border on the core.
 *
 * This is a presentational wrapper: it forwards `...rest` to the outer element,
 * so callers can pass `aria-*`, `role`, `id`, etc. without weakening semantics.
 * It renders a plain <div> by default (use `as` for <section>/<article>/<li>).
 */

type Elevation = "rest" | "raised";
type Accent = "none" | "brand" | "success" | "warning" | "danger" | "info";

const ACCENT_RING: Record<Exclude<Accent, "none">, string> = {
  brand: "ring-brand/30",
  success: "ring-success/30",
  warning: "ring-warning/30",
  danger: "ring-danger/30",
  info: "ring-info/30",
};

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Render element for the OUTER shell. Default `div`. */
  as?: "div" | "section" | "article" | "li";
  /** `raised` floats the tile with `--shadow-float`; `rest` is a resting card. */
  elevation?: Elevation;
  /** Tints the hairline ring to a semantic hue (meaning, not decoration). */
  accent?: Accent;
  /** Inner-core padding. Default `md` (24px). */
  pad?: "none" | "sm" | "md" | "lg";
  /** Extra classes on the INNER core (where content lives). */
  innerClassName?: string;
  children: React.ReactNode;
}

// Responsive padding: lighter on phones (<md) so the inner core doesn't eat the
// usable width at 320–430px, then the full premium gutter from md up. The radius
// math (24px shell − 6px gap → 18px inner) is unaffected.
const PAD: Record<NonNullable<CardProps["pad"]>, string> = {
  none: "",
  sm: "p-3 md:p-4",
  md: "p-4 md:p-6",
  lg: "p-5 md:p-8",
};

export function Card({
  as: Tag = "div",
  elevation = "rest",
  accent = "none",
  pad = "md",
  className = "",
  innerClassName = "",
  children,
  ...rest
}: CardProps) {
  const accentRing =
    accent === "none" ? "ring-[--bezel-ring]" : ACCENT_RING[accent];
  const shellShadow = elevation === "raised" ? "shadow-float" : "shadow-xs";
  const innerSurface =
    elevation === "raised" ? "bg-surface-raised" : "bg-surface";

  return (
    <Tag
      className={[
        // outer shell — the machined tray
        "rounded-2xl bg-[--bezel-shell] p-1.5 ring-1",
        accentRing,
        shellShadow,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <div
        className={[
          // inner core — concentric (24px − 6px = 18px), soft inner top edge
          "rounded-bezel-inner shadow-bezel-inner",
          innerSurface,
          PAD[pad],
          innerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </Tag>
  );
}
