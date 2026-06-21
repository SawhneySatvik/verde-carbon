import * as React from "react";

/**
 * Verdé brand mark — "Concentric Ripple / Strata".
 *
 * The eco motif is NOT a leaf. It reads two ways at once:
 *  - a RIPPLE radiating from a centre dot — one small action sending rings
 *    outward (the product's thesis: small changes propagate), and
 *  - STRATA / contour lines — earth and topographic layers, the ground we're
 *    protecting.
 * The rings open downward into an arc rather than full circles, so the lower
 * half reads as a horizon / measuring dial — a calm instrument, not a logo
 * shouting "green". Drawn on a 32×32 grid; uses `currentColor` for the rings and
 * `var(--brand-accent)` for the centre seed so it carries brand presence while
 * inheriting text color for the strata.
 *
 * Accessibility:
 *  - When paired with the visible "Verdé" wordmark, pass nothing → it renders
 *    `aria-hidden` (decorative; the text is the accessible name).
 *  - When standing alone (favicon-style, no adjacent text), pass a `title` (e.g.
 *    "Verdé") → it gains `role="img"` + `<title>` and is announced once.
 */

export interface BrandMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  /** Accessible name; set ONLY when the mark stands alone without text. */
  title?: string;
}

export function BrandMark({
  size = 28,
  title,
  className,
  ...props
}: BrandMarkProps) {
  const labelled = typeof title === "string" && title.length > 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      focusable={false}
      {...props}
    >
      {labelled ? <title>{title}</title> : null}
      {/* outer strata ring (open downward → horizon arc) */}
      <path
        d="M4 19a12 12 0 0 1 24 0"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.45}
      />
      {/* middle ripple ring */}
      <path
        d="M8.5 19a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* inner ripple ring */}
      <path
        d="M12.5 19a3.5 3.5 0 0 1 7 0"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* horizon baseline the rings sit on */}
      <path
        d="M5 19h22"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.2}
      />
      {/* brand seed dot — the single action the ripples radiate from */}
      <circle cx="16" cy="19" r="1.9" fill="var(--brand-accent)" />
    </svg>
  );
}
