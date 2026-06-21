/** "Not ranked" section — candidates with no sourced saving, listed rather than guessed. */

import type { SkippedCandidate } from "./types";

export function SkippedSection({ skipped }: { skipped: SkippedCandidate[] }) {
  return (
    <section aria-labelledby="skipped-title" className="mt-10">
      <h2
        id="skipped-title"
        className="font-display text-h4 text-text-secondary"
      >
        Not ranked
      </h2>
      <p className="mt-2 max-w-[58ch] text-body-sm text-text-muted">
        We couldn&rsquo;t source a saving for these, so they were left out
        rather than shown with a guessed number.
      </p>
      <ul className="mt-3 space-y-1.5">
        {skipped.map((s) => (
          <li
            key={s.id}
            className="text-body-sm text-text-secondary before:mr-2 before:text-text-muted before:content-['—']"
          >
            <span className="font-medium text-text">{s.title}</span> {s.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
