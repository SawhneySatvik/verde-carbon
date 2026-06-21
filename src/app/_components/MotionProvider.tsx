"use client";

import {
  LazyMotion,
  domAnimation,
  MotionConfig,
  useReducedMotion,
} from "motion/react";

/**
 * MotionProvider — the bundle-conscious Framer Motion entry point.
 *
 * Later phases animate with the lightweight `m` components from "motion/react"
 * (NOT the full `motion` namespace). `LazyMotion` + `domAnimation` ships only
 * the DOM animation feature set (~15 KB) instead of the full library; using `m`
 * keeps the per-component runtime tiny. Wrapping the tree here means no screen
 * has to re-import the feature bundle.
 *
 * Reduced-motion accessibility — reveals enhance, never gate visibility:
 *
 *  - `reducedMotion="user"` makes every motion component honor the OS
 *    `prefers-reduced-motion` setting, matching the CSS rule in globals.css.
 *  - Framer's `"user"` mode disables transform/layout movement under reduced
 *    motion but, by design, STILL CROSSFADES `opacity`. Our entrance reveals
 *    mount at `opacity: 0` and fade in, so under reduced motion that crossfade
 *    would otherwise keep running — leaving content rendered semi-transparent
 *    while it settles (a real WCAG 1.4.3 contrast hazard: faded text/fills dip
 *    below AA mid-fade, and an automated contrast snapshot can catch that frame).
 *    To honor "content is visible by default", when reduced motion is requested
 *    we collapse every transition to an INSTANT one (`duration: 0`), so reveals
 *    resolve to their final, fully-opaque state immediately — no fade frame,
 *    no transient low-contrast paint, no motion.
 *
 * Usage in a later phase:
 *   import { m } from "motion/react";
 *   <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} />
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion="user"
        // Under reduced motion, force every reveal/transition to resolve
        // instantly (incl. the opacity crossfade Framer otherwise keeps), so
        // content paints at its final opaque colour — never a faded frame.
        transition={reduce ? { duration: 0 } : undefined}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
