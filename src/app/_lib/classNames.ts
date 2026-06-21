/** Shared Tailwind class fragments so the focus-ring chain lives in one place. */

/** Visible focus-visible ring (never outline:none alone) — WCAG 2.4.7. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]";
