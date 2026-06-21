"use client";

import { Card } from "../../../_components/Card";

/**
 * Resolving spinner — a polite status card shown while a keep/merge resolution
 * is in flight.
 */

export function StatusSpinner() {
  return (
    <Card pad="lg">
      <p
        role="status"
        className="flex items-center gap-2.5 text-body text-text-secondary"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 motion-safe:animate-spin"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity="0.25"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Working on it…
      </p>
    </Card>
  );
}
