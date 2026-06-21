"use client";

import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";

/**
 * Staggered bento tile reveal. Transform/opacity only; honoured by the provider's
 * `reducedMotion="user"`, so reduced-motion users get the final state instantly.
 * Content is visible by default — `animate` is the steady state, never gated.
 */
export function RevealTile({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.48,
        delay: index * 0.06,
        ease: EASE_OUT_QUART,
      }}
    >
      {children}
    </m.div>
  );
}
