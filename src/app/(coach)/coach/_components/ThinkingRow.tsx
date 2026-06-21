/** The animated "Coach is thinking…" placeholder row shown while a reply is in flight. */

import { Ripple } from "../../../_components/icons";

export function ThinkingRow() {
  return (
    <li aria-hidden="true" className="flex flex-col items-start gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-brand-fg">
        <Ripple size={13} />
        Coach
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-surface-sunken px-4 py-3 text-body text-text-muted">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 rounded-pill bg-text-muted motion-safe:animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-pill bg-text-muted motion-safe:animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-pill bg-text-muted motion-safe:animate-pulse [animation-delay:300ms]" />
        </span>
        Thinking
      </span>
    </li>
  );
}
