import Link from "next/link";
import { AnnouncerProvider } from "./Announcer";
import { Banner } from "./Banner";
import { SessionBootstrap } from "./SessionBootstrap";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { Gauge, PlusLog, ChartLine, Target, Coach } from "./icons";

/**
 * Global app shell.
 *
 * Provides, once, for every screen:
 *  - a visible-on-focus "Skip to main content" link as the first focusable
 *    element (WCAG 2.4.1);
 *  - semantic landmarks: <header>/<nav>/<main>/<footer>;
 *  - primary nav (Dashboard / Log / Insights / Coach / Goal) as a real list of
 *    links;
 *  - the persistent dismissible anonymous/save banner;
 *  - the accessible ThemeToggle (light → dark → system);
 *  - a single aria-live region (via AnnouncerProvider) for app-wide
 *    announcements (parse results, save confirmations, errors, unit changes).
 *
 * The shell is intentionally NOT sticky over the focused target, so a focused
 * element is never obscured by a fixed header (WCAG 2.2 2.4.11).
 *
 * The "Concentric Ripple" BrandMark + a
 * Space-Grotesk display wordmark replace the 5px pill placeholder; nav links gain
 * the inline icon set (aria-hidden, text is the name); the footer echoes the mark
 * quietly. Every a11y property above is preserved verbatim — this is presentation.
 *
 * Mobile / tablet (responsive pass): below `md` (<768px) the now-FIVE inline nav
 * links + ThemeToggle overflow the header, so the inline nav cluster is
 * `hidden md:flex` and a single accessible hamburger (MobileNavDrawer) — a
 * focus-trapped slide-out dialog holding the same links + ThemeToggle — takes its
 * place (`md:hidden`). (The breakpoint moved sm → md when Coach became the 5th
 * destination: five labelled links no longer fit at 640px.) The primary nav links
 * stay in the DOM for AT and tests; only their visual placement changes by
 * viewport.
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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AnnouncerProvider>
      <SessionBootstrap />
      <a
        href="#main-content"
        className="sr-only z-sticky rounded-sm bg-brand px-4 py-2 text-body font-medium text-text-onbrand focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
      >
        Skip to main content
      </a>

      <div className="flex min-h-[100dvh] flex-col bg-bg">
        <header className="border-b border-border bg-surface">
          <Banner />
          <div className="mx-auto flex max-w-app items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-md text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]">
                <BrandMark size={22} />
              </span>
              <span className="font-display text-h3 font-bold tracking-[-0.01em]">
                Verdé
              </span>
            </Link>

            {/* Inline nav cluster — md and up. Below md it is replaced by the
                MobileNavDrawer hamburger (which holds these same links + theme).
                Five labelled links no longer fit at 640px, so the breakpoint is
                md, not sm. */}
            <div className="hidden items-center gap-2 md:flex">
              <nav aria-label="Primary">
                <ul className="flex flex-wrap items-center gap-0.5">
                  {NAV_ITEMS.map(({ href, label, Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-2 text-body-sm font-medium text-text-secondary transition-colors duration-fast ease-out-quart hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                      >
                        <Icon
                          size={18}
                          className="text-text-muted transition-colors duration-fast ease-out-quart group-hover:text-text-secondary"
                        />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <span aria-hidden="true" className="h-6 w-px bg-border" />
              <ThemeToggle />
            </div>

            {/* Mobile nav — below sm only. */}
            <MobileNavDrawer />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 focus:outline-none"
        >
          {children}
        </main>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-app flex-col gap-3 px-4 py-8 text-caption text-text-muted md:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-text-secondary">
              <BrandMark size={18} className="shrink-0 text-text-muted" />
              <span className="font-display text-body-sm font-semibold text-text">
                Verdé
              </span>
            </div>
            <p className="max-w-prose">
              Every number on Verdé is computed by a deterministic calculator
              from published emission factors — never invented by AI.
            </p>
            <p>
              <Link
                href="/how-it-works"
                className="rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                How this works
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </AnnouncerProvider>
  );
}
