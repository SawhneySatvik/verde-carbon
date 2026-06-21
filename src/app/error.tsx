"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Badge } from "./_components/Badge";
import { AlertTriangle } from "./_components/icons";

/**
 * Route-level error boundary — never a dead screen.
 *
 * When a render throws, Next.js renders this in place of the segment so the app
 * degrades gracefully: a plain-language message, a retry action, and a path back
 * home — instead of a blank or crashed page. Errors are surfaced via
 * role="alert" and focus is moved to the heading so a keyboard / screen-reader
 * user is taken straight to the recovery message (focus moved to the message).
 * Internals are never exposed to the user.
 *
 * Look: a single floating Double-Bezel panel centred on the canvas, a calm
 * (non-alarming) warning glyph, the reassurance copy, and the two recovery
 * actions — matching the welcome hero's material without shouting.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // In a real deployment this would forward to the error reporter; here we keep
    // it minimal and never expose internals to the user.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [error]);

  useEffect(() => {
    // Take the keyboard / SR user to the recovery message.
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-app items-center justify-center px-4 py-20 md:px-6">
      <div
        role="alert"
        className="w-full max-w-[40rem] rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring] shadow-float"
      >
        <div className="rounded-bezel-inner bg-surface-raised p-8 shadow-bezel-inner md:p-10">
          <div className="flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-warning-bg text-warning-fg ring-1 ring-[--bezel-ring]"
            >
              <AlertTriangle size={24} />
            </span>

            <div className="mt-5">
              <Badge tone="warning">Something broke</Badge>
            </div>

            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-4 max-w-[20ch] text-balance font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em] text-text focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
            >
              This screen ran into a problem.
            </h1>

            <p className="mx-auto mt-4 max-w-[52ch] text-pretty text-body-lg text-text-secondary">
              Your data is safe — nothing was lost. You can try this screen
              again, or head back to the start.
            </p>

            <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex min-h-[48px] items-center justify-center rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex min-h-[48px] items-center justify-center rounded-sm border border-border-interactive bg-surface px-6 py-3 text-body font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                Go to start
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
