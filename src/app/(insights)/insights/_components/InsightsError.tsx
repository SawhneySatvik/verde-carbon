/** Error state — accessible alert with a focusable message and a retry button. */

import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { AlertTriangle } from "../../../_components/icons";

export function InsightsError({
  errorRef,
  onRetry,
}: {
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  onRetry: () => void;
}) {
  return (
    <Card as="div" role="alert" accent="danger" pad="lg">
      <h2 className="inline-flex items-center gap-2 font-display text-h3 text-danger-fg">
        <AlertTriangle size={22} className="shrink-0" aria-hidden="true" />
        Couldn&rsquo;t load insights
      </h2>
      <p
        ref={errorRef}
        tabIndex={-1}
        className="mt-2 max-w-prose text-body text-text focus:outline-none"
      >
        Something went wrong. Your data is safe.
      </p>
      <div className="mt-5">
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </Card>
  );
}
