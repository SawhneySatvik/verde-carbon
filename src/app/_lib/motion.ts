/** Shared motion constants so easing/spring values live in one place. */

/** ease-out-quart cubic-bezier — the standard entrance/transition curve. */
export const EASE_OUT_QUART = [0.16, 1, 0.3, 1] as const;

/** Soft spring for press/scale interactions (transform-only, reduced-motion safe). */
export const PRESS_SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 32,
} as const;
