"use client";

import Link from "next/link";
import type { Streak } from "@core/schemas";
import { Badge } from "../../../_components/Badge";
import { BrandMark } from "../../../_components/BrandMark";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import {
  AlertTriangle,
  ArrowUpRight,
  PlusLog,
  Ripple,
  Sparkles,
} from "../../../_components/icons";

/** Empty state: explains the data model and offers first-log + sample-data CTAs. */
export function EmptyDashboard({
  streak,
  onLoadSample,
  sampleBusy,
}: {
  streak: Streak | null;
  onLoadSample: () => void;
  sampleBusy: boolean;
}) {
  return (
    <Card
      as="section"
      elevation="raised"
      accent="brand"
      pad="none"
      innerClassName="relative overflow-hidden px-6 py-14 text-center md:px-10 md:py-20"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-48 w-72 -translate-x-1/2 rounded-pill bg-surface-brand-subtle opacity-60 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-prose flex-col items-center">
        <span
          aria-hidden="true"
          className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
        >
          <BrandMark size={36} />
        </span>
        <h2 className="mt-6 text-balance font-display text-h2 text-text">
          Nothing logged yet
        </h2>
        <p className="mt-3 text-pretty text-body text-text-secondary">
          Your dashboard fills in as you log activities. Every number
          you&rsquo;ll see here is computed by our calculator from published
          emission factors — never invented. Log your first activity to see your
          trend, category breakdown, and goal progress.
        </p>
        {streak && streak.count > 0 && (
          <p className="mt-4">
            <Badge tone="brand" icon={<Ripple size={13} />}>
              Current streak: {streak.count} day{streak.count === 1 ? "" : "s"}
            </Badge>
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/log"
            className="group inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            <PlusLog size={18} aria-hidden="true" />
            Log your first activity
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
            >
              <ArrowUpRight size={15} />
            </span>
          </Link>
          <Button
            variant="secondary"
            onClick={onLoadSample}
            loading={sampleBusy}
            leadingIcon={<Sparkles size={18} />}
          >
            Load sample data
          </Button>
        </div>
        <p className="mt-4 text-caption text-text-muted">
          Sample data fills your own demo account with realistic activities —
          every number still computed by our calculator from published factors,
          never invented. Clear it any time.
        </p>
      </div>
    </Card>
  );
}

/** Error state: an `role="alert"` card whose focusable copy + Retry recover the view. */
export function DashboardError({
  errorRef,
  onRetry,
}: {
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  onRetry: () => void;
}) {
  return (
    <Card as="div" role="alert" accent="danger" innerClassName="p-8">
      <h2 className="inline-flex items-center gap-2 font-display text-h3 text-danger-fg">
        <AlertTriangle size={22} className="shrink-0" aria-hidden="true" />
        Couldn&rsquo;t load your dashboard
      </h2>
      <p
        ref={errorRef}
        tabIndex={-1}
        className="mt-2 max-w-prose text-body text-text focus:outline-none"
      >
        Something went wrong fetching your data. Your logs are safe — this is
        just the view.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[48px] items-center justify-center rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        >
          Retry
        </button>
      </div>
    </Card>
  );
}

/** Loading state: an `aria-live` status mirroring the bento layout with pulsing tiles. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      {/* Skeletons mirror the bento footprint; pulse is motion-safe only so
          reduced-motion users get a calm static placeholder. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <SkeletonTile className="lg:col-span-7 lg:row-span-2" height="h-72" />
        <SkeletonTile className="lg:col-span-5" height="h-44" />
        <SkeletonTile className="lg:col-span-5" height="h-44" />
        <SkeletonTile className="lg:col-span-12" height="h-56" />
        <SkeletonTile className="lg:col-span-12" height="h-72" />
        <SkeletonTile className="lg:col-span-12" height="h-72" />
      </div>
    </div>
  );
}

function SkeletonTile({
  className = "",
  height,
}: {
  className?: string;
  height: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring] ${className}`}
    >
      <div
        className={`${height} rounded-bezel-inner bg-surface-sunken motion-safe:animate-pulse`}
      />
    </div>
  );
}
