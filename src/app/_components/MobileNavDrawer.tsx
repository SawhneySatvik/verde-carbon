"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { ThemeToggle } from "./ThemeToggle";
import { Gauge, PlusLog, ChartLine, Target, Coach, Menu, Close } from "./icons";

/**
 * MobileNavDrawer — the `<md` (<768px) primary-navigation surface (responsive
 * pass). On phones and small tablets the 5 inline nav links + brand + ThemeToggle
 * overflow the header, so the inline nav is hidden (`hidden md:flex` in AppShell)
 * and replaced by this single hamburger button that opens an accessible slide-out
 * drawer. (Breakpoint moved sm → md when Coach became the 5th destination.)
 *
 * Accessibility model — mirrors the goal ConfirmDialog focus-trap pattern exactly
 * (the verified accessible floor), adapted to a navigation drawer:
 *  - The trigger is a real <button> with `aria-haspopup="dialog"`,
 *    `aria-expanded` (toggles true/false) and `aria-controls` pointing at the
 *    panel, and a ≥44px target.
 *  - The panel is `role="dialog"` + `aria-modal="true"`, labelled by its heading.
 *  - On open, focus moves INTO the panel (its close button); on close, focus is
 *    RESTORED to the trigger button (stored opener ref).
 *  - Esc closes; Tab is trapped within the panel (wraps first↔last); a scrim
 *    click closes; navigating (pathname change) closes.
 *  - Semantic z-index (`z-backdrop` scrim under `z-modal` panel) — no magic 9999.
 *  - Body scroll is locked while open (optional nicety) and restored on close.
 *
 * Motion: a transform/opacity slide-in via the app-level MotionProvider's
 * `m`/LazyMotion layer (translateX + scrim opacity) — GPU-cheap and
 * reduced-motion safe. `reducedMotion="user"` collapses the translateX, but
 * Framer still crossfades `opacity`; the panel mounts at `opacity:0.6` and the
 * scrim at `0`, so under reduced motion we additionally force the transition to
 * `{ duration: 0 }` (via `useReducedMotion`) so both resolve to their final
 * opaque state instantly — no ~0.28s fade leak. The panel still renders to its
 * final visible state regardless; content is never gated on the animation.
 */

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  Icon: (props: { size?: number; className?: string }) => React.ReactElement;
}> = [
  { href: "/dashboard", label: "Dashboard", Icon: Gauge },
  { href: "/log", label: "Log", Icon: PlusLog },
  { href: "/insights", label: "Insights", Icon: ChartLine },
  { href: "/coach", label: "Coach", Icon: Coach },
  { href: "/goal", label: "Goal", Icon: Target },
];

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const panelId = `mobile-nav-${reactId}`;
  const titleId = `mobile-nav-title-${reactId}`;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const wasOpen = useRef(false);

  // Under reduced motion, collapse the slide/scrim transition to an instant one
  // so the opacity crossfade Framer otherwise keeps running (panel 0.6→1, scrim
  // 0→1) resolves immediately to its final opaque state — no fade leak.
  const reduce = useReducedMotion();
  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.28, ease: EASE_OUT_QUART };
  const scrimTransition = reduce
    ? { duration: 0 }
    : { duration: 0.2, ease: EASE_OUT_QUART };

  // Close on navigation: when the route changes while the drawer is open, the
  // user has followed a link — collapse it (focus returns to the trigger).
  useEffect(() => {
    if (wasOpen.current) {
      setOpen(false);
    }
  }, [pathname]);

  // Move focus into the panel on open; restore it to the trigger on close.
  // Lock body scroll while open.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
    if (wasOpen.current) {
      // Only restore focus on a genuine open → close transition (not on mount).
      // Defer one frame so the restore wins any native focus the closing
      // interaction (e.g. a scrim click) hands to <body> first.
      wasOpen.current = false;
      const id = requestAnimationFrame(() => triggerRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  function focusableEls(): HTMLElement[] {
    const root = panelRef.current;
    if (!root) {
      return [];
    }
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key !== "Tab") {
      return;
    }
    const els = focusableEls();
    if (els.length === 0) {
      return;
    }
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      {/* Trigger — visible only below md; the inline nav covers md and up. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Open navigation menu"
        className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] md:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-backdrop md:hidden">
          {/* Scrim — tinted, fades in (decorative); clicking it closes the
              drawer. It is the interactive backdrop, so the handler lives here
              (it covers the container, so a container-level handler never sees
              the click). The panel sits above it and stops propagation. */}
          <m.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={scrimTransition}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-text/40"
          />

          {/* Slide-out panel — the focus-trapped navigation dialog. */}
          <m.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            transition={transition}
            className="absolute inset-y-0 right-0 z-modal flex w-[min(20rem,86vw)] flex-col border-l border-border bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2
                id={titleId}
                className="font-display text-h4 font-semibold text-text"
              >
                Menu
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-muted transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                <Close size={20} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Primary (mobile)" className="flex-1 px-3 py-4">
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="group inline-flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2.5 text-body font-medium text-text-secondary transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                    >
                      <Icon
                        size={20}
                        className="text-text-muted transition-colors duration-fast ease-out-quart group-hover:text-text-secondary"
                      />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <span className="text-body-sm text-text-secondary">Theme</span>
              <ThemeToggle />
            </div>
          </m.div>
        </div>
      )}
    </>
  );
}
