"use client";

import { m } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Route-transition wrapper. `template.tsx` re-mounts on every navigation, so a
 * subtle fade + scale-up plays as each route enters (no exit animation — the
 * App Router replaces the DOM, so exits are unreliable; we only animate in).
 *
 * Accessibility / SSR safety:
 * - The FIRST paint (initial load / SSR + hydration) is NOT animated
 *   (`initial={false}`), so content is fully visible immediately — no
 *   flash-of-invisible-content and no hydration mismatch. Only subsequent
 *   client navigations animate.
 * - Transform/opacity only; under `prefers-reduced-motion` the shared
 *   MotionProvider collapses the transition to `duration: 0` and the globals
 *   `[style*="opacity"]` guard forces full opacity — content is never stuck faded.
 * - It focuses nothing, so the skip-link → `main#main-content` flow and each
 *   screen's focus-on-mount are untouched. Per-screen reveals layer in after.
 */
// Module-scoped: false on first paint, true after the app has mounted once.
// Persists across template re-mounts (navigations) for the session.
let hasMountedOnce = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipAnimation = useRef(!hasMountedOnce);

  useEffect(() => {
    hasMountedOnce = true;
  }, []);

  return (
    <m.div
      key={pathname}
      initial={skipAnimation.current ? false : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
    >
      {children}
    </m.div>
  );
}
