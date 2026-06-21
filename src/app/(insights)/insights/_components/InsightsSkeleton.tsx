/** Loading placeholder — motion-safe pulse mirroring the ranked cards, aria-live polite. */

export function InsightsSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading insights…</span>
      {/* Skeletons mirror the ranked cards; pulse is motion-safe only so
          reduced-motion users get a calm static placeholder. */}
      <ul className="space-y-5">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            aria-hidden="true"
            className="rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring]"
          >
            <div className="h-40 rounded-bezel-inner bg-surface-sunken motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
