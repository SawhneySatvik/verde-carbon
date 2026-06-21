"use client";

/** The suggested-prompt chip row — real <button>s that prefill + send, disabled while thinking. */

import { Chip } from "../../../_components/Badge";

export function SuggestedPrompts({
  headingId,
  label,
  prompts,
  onPick,
  disabled,
}: {
  headingId: string;
  label: string;
  prompts: readonly string[];
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p
        id={headingId}
        className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted"
      >
        {label}
      </p>
      <ul aria-labelledby={headingId} className="mt-2.5 flex flex-wrap gap-2.5">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <Chip
              tone="brand"
              disabled={disabled}
              onClick={() => onPick(prompt)}
            >
              {prompt}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
