/** The greeting shown above the suggested prompts when the conversation is still empty. */

import { Ripple } from "../../../_components/icons";

export function ConversationIntro() {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
      >
        <Ripple size={20} />
      </span>
      <div>
        <p className="text-body text-text-secondary">
          Hi — I&rsquo;m your reduction coach. Ask me where to focus next, or
          pick one of the prompts below. I&rsquo;ll talk you through the
          <em> why</em>; the exact figures stay on the right, straight from your
          calculator.
        </p>
      </div>
    </div>
  );
}
