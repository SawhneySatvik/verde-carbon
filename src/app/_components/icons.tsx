import * as React from "react";

/**
 * Verdé inline icon set.
 *
 * A small, consistent, ultra-light line set (stroke 1.5, round joins/caps) that
 * replaces the emoji / Unicode arrows (▲ ▼ ↗ ⚙ ☰ …) used in earlier components.
 * Drawn on a 24×24 grid; `currentColor` so they inherit text color and theme.
 *
 * Accessibility contract:
 *  - Default `aria-hidden="true"` + `focusable={false}` → decorative, ignored by
 *    AT. Pair with a visible text label (the common case).
 *  - To make an icon meaningful (icon-only button/link), pass a `title`: it gets
 *    `role="img"` + an `<title>` and is announced. Always also give the control
 *    itself an `aria-label`.
 *  - Sizing via the `size` prop (px) or className (`h-* w-*`); 24px default meets
 *    the visual floor and is never below the 24px UI target when used in buttons.
 */

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Pixel size for both width and height. Default 24. */
  size?: number;
  /** Accessible name. When set the icon becomes meaningful (role="img"). */
  title?: string;
}

function Svg({
  size = 24,
  title,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  const labelled = typeof title === "string" && title.length > 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      focusable={false}
      {...props}
    >
      {labelled ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ----------------------------- directional ------------------------------ */
/** Emissions fell (good) — replaces ▼ in carbon deltas. Pair with sign + words. */
export function ArrowDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  );
}
/** Emissions rose (bad) — replaces ▲ in carbon deltas. Pair with sign + words. */
export function ArrowUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}
/** Trailing CTA arrow (the button-in-button "↗"). */
export function ArrowUpRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </Svg>
  );
}
export function ChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}
export function ChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

/* ------------------------------- status --------------------------------- */
export function CheckCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21.5 12a9.5 9.5 0 1 1-3.2-7.1" />
      <path d="m9 12 2.5 2.5L21 5" />
    </Svg>
  );
}
export function AlertTriangle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 2.7 20a1 1 0 0 0 .9 1.5h16.8a1 1 0 0 0 .9-1.5L12 4Z" />
      <path d="M12 9.5v4.5M12 17.5h.01" />
    </Svg>
  );
}
export function AlertCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5v5M12 16.5h.01" />
    </Svg>
  );
}
export function InfoCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </Svg>
  );
}
export function Close(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Svg>
  );
}

/* ------------------------------ navigation ------------------------------ */
export function Gauge(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m13.5 11.5-2.8 2.8" />
      <circle cx="10.7" cy="14.3" r="1.4" />
    </Svg>
  );
}
export function PlusLog(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Svg>
  );
}
export function ChartLine(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="m7 14 3.5-4 3 2.5L20 6" />
    </Svg>
  );
}
export function Target(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" />
    </Svg>
  );
}
/** Speech bubble — the conversational Coach destination. */
export function Coach(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8.5 10.5h7M8.5 13h4" />
    </Svg>
  );
}
export function Settings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </Svg>
  );
}
export function Menu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

/* ------------------------------ theme ----------------------------------- */
export function Sun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </Svg>
  );
}
export function Moon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z" />
    </Svg>
  );
}
/** System / auto theme. */
export function Monitor(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </Svg>
  );
}

/** Anonymous / private session — replaces the 🔒 emoji in the save banner. */
export function Lock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2" />
    </Svg>
  );
}

/* ------------------------------- eco ------------------------------------ */
/** Concentric ripple — the Verdé brand motif (echoed by BrandMark). */
export function Ripple(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 6a6 6 0 0 1 6 6" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </Svg>
  );
}

/* ------------------------------- demo ------------------------------------ */
/** Sparkles — the "Load sample data" demo affordance. Pair with a text label. */
export function Sparkles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5l1.6 4.2 4.2 1.6-4.2 1.6L12 16.1l-1.6-4.2-4.2-1.6 4.2-1.6L12 4.5Z" />
      <path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
    </Svg>
  );
}
