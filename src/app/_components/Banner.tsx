"use client";

import Link from "next/link";
import { useState } from "react";
import { m } from "motion/react";
import { PRESS_SPRING } from "@/app/_lib/motion";
import { Lock, Close, ArrowUpRight } from "./icons";

/**
 * Persistent, dismissible anonymous/save banner. The session/anonymous banner is
 * announced, not just visual.
 *
 * - Rendered with role="region" + an accessible name so screen readers can find
 *   and announce it; it is NOT modal and never blocks the page (the save banner
 *   is persistent but always dismissible and never modal-blocking).
 * - The "Save my data" CTA links to the account-linking flow; a real
 *   <a> because it navigates. It nests its trailing arrow in a button-in-button
 *   island.
 * - The dismiss control is a real <button> with an aria-label and its own focus
 *   ring; dismissing only hides the banner for the session.
 *
 * A calm brand-subtle wash on the sunken plane, the 🔒 emoji is now
 * the inline `Lock` icon and the `×` is the `Close` icon (both aria-hidden), and
 * controls get a soft spring press via the shared `m` layer (reduced-motion safe).
 */
export function Banner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Account status"
      className="border-b border-border bg-surface-sunken"
    >
      <div className="mx-auto flex max-w-app flex-col gap-2 px-4 py-2.5 text-body-sm sm:flex-row sm:items-center sm:justify-between md:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-text-secondary">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-brand-subtle text-brand-fg"
          >
            <Lock size={15} />
          </span>
          <span>
            You&rsquo;re exploring anonymously — sign in anytime to save &amp;
            sync your data.
          </span>
        </p>
        <div className="flex items-center gap-2">
          <m.span
            whileTap={{ scale: 0.97 }}
            transition={PRESS_SPRING}
            className="inline-flex"
          >
            <Link
              href="/link"
              className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-border-interactive bg-surface py-1.5 pl-4 pr-1.5 text-body-sm font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
            >
              Save my data
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-surface-sunken transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
              >
                <ArrowUpRight size={15} />
              </span>
            </Link>
          </m.span>
          <m.button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss account status message"
            whileTap={{ scale: 0.94 }}
            transition={PRESS_SPRING}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-text-muted transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            <Close size={18} aria-hidden="true" />
          </m.button>
        </div>
      </div>
    </div>
  );
}
