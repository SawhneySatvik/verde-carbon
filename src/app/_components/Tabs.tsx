"use client";

import * as React from "react";
import { m } from "motion/react";
import { FOCUS_RING } from "@/app/_lib/classNames";

/**
 * Tabs — navigation primitive implementing the WAI-ARIA Tabs pattern.
 *
 * Semantics (preserved as the hard floor):
 *  - a `role="tablist"` with an accessible name (`aria-label`);
 *  - each tab is `role="tab"`, with `aria-selected`, `aria-controls` → its
 *    panel, and a roving tabindex (only the active tab is in the Tab sequence;
 *    arrows move between tabs);
 *  - each panel is `role="tabpanel"`, `aria-labelledby` its tab, and `tabIndex=0`
 *    so keyboard users can scroll/read it; inactive panels are `hidden`;
 *  - keyboard: ←/→ (and Home/End) move focus AND activate (automatic activation),
 *    wrapping at the ends; visible focus ring on every tab; ≥44px targets.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`). The
 * active-tab indicator slides via the `m` layer (transform/opacity only → honored
 * by `reducedMotion="user"`); the tab text is fully visible without it.
 */

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** Accessible name for the tablist (required for a11y). */
  label: string;
  items: ReadonlyArray<TabItem>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Render the active panel's content. */
  children: (activeValue: string) => React.ReactNode;
  idBase?: string;
  className?: string;
}

export function Tabs({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  children,
  idBase,
  className = "",
}: TabsProps) {
  const reactId = React.useId();
  const base = idBase ?? reactId;
  const firstEnabled = items.find((i) => !i.disabled)?.value ?? items[0]?.value;
  const [internal, setInternal] = React.useState(defaultValue ?? firstEnabled);
  const active = value ?? internal;

  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: string) => {
    if (value === undefined) {
      setInternal(next);
    }
    onValueChange?.(next);
  };

  const focusTab = (index: number) => {
    const item = items[index];
    if (!item) return;
    tabRefs.current[index]?.focus();
    if (!item.disabled) {
      select(item.value);
    }
  };

  const moveFocus = (from: number, dir: 1 | -1) => {
    const count = items.length;
    let i = from;
    for (let step = 0; step < count; step++) {
      i = (i + dir + count) % count;
      if (!items[i]?.disabled) {
        focusTab(i);
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveFocus(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveFocus(index, -1);
        break;
      case "Home":
        e.preventDefault();
        focusTab(items.findIndex((i) => !i.disabled));
        break;
      case "End": {
        e.preventDefault();
        const last = [...items]
          .map((i, idx) => ({ i, idx }))
          .reverse()
          .find(({ i }) => !i.disabled);
        if (last) focusTab(last.idx);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-sunken p-1"
      >
        {items.map((item, index) => {
          const isActive = item.value === active;
          const tabId = `${base}-tab-${item.value}`;
          const panelId = `${base}-panel-${item.value}`;
          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              id={tabId}
              type="button"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              onClick={() => !item.disabled && select(item.value)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={[
                "relative inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-4 py-2",
                "text-body-sm font-medium leading-none",
                "transition-colors duration-fast ease-out-quart",
                FOCUS_RING,
                "disabled:cursor-not-allowed disabled:opacity-50",
                isActive ? "text-text" : "text-text-secondary hover:text-text",
              ].join(" ")}
            >
              {isActive ? (
                <m.span
                  layoutId={`${base}-tab-indicator`}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-md bg-surface shadow-xs"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              ) : null}
              <span className="relative inline-flex items-center gap-1.5">
                {item.icon ? (
                  <span aria-hidden="true" className="inline-flex shrink-0">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {items.map((item) => {
        const tabId = `${base}-tab-${item.value}`;
        const panelId = `${base}-panel-${item.value}`;
        const isActive = item.value === active;
        return (
          <div
            key={item.value}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={!isActive}
            className="mt-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            {isActive ? children(active) : null}
          </div>
        );
      })}
    </div>
  );
}
