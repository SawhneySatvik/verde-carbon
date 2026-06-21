import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { MotionProvider } from "./MotionProvider";
import { AppShell } from "./AppShell";

/**
 * AppShell — this is a PRESENTATION change, so every structural a11y
 * property must survive verbatim: the skip-link is the first focusable element,
 * the page exposes header/nav/main/footer landmarks, <main> is a focus target
 * (id + tabIndex=-1), the primary nav is a labelled list of links, and the
 * aria-live regions (via AnnouncerProvider) are present. The new BrandMark +
 * Space-Grotesk wordmark replace the old 5px pill; the ThemeToggle is rendered.
 *
 * Responsive pass: a `<sm`-only hamburger (MobileNavDrawer) opens a focus-trapped
 * `role="dialog"` nav. The inline nav cluster is gated `hidden sm:flex` but stays
 * in the DOM (AT + the four-links assertion below are unaffected). These new tests
 * cover the menu button's ARIA + the drawer's focus model — without weakening any
 * existing assertion.
 */
function renderShell() {
  return render(
    <ThemeProvider>
      <MotionProvider>
        <AppShell>
          <h1>Dashboard</h1>
        </AppShell>
      </MotionProvider>
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    // SessionBootstrap POSTs /api/session on mount; give it a quiet stub so the
    // effect never rejects during the test.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ token: "t", uid: "u", isAnonymous: true }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    );
  });

  it("renders the skip link as the FIRST focusable element targeting #main-content", () => {
    const { container } = renderShell();
    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");

    // First focusable in DOM order must be the skip link (WCAG 2.4.1).
    const focusables = container.querySelectorAll(
      'a[href], button, input, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusables[0]).toBe(skip);
  });

  it("exposes header / nav / main / footer landmarks", () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument(); // <header>
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // <footer>
    expect(
      screen.getByRole("navigation", { name: /Primary/i }),
    ).toBeInTheDocument();
  });

  it("keeps <main> a focus target (id + tabIndex=-1)", () => {
    renderShell();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(
      within(main).getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("renders the primary nav as a list of five real links (incl. Coach)", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: /^Primary$/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/log",
      "/insights",
      "/coach",
      "/goal",
    ]);
    // ≥44px target preserved on every nav link.
    links.forEach((l) => expect(l.className).toMatch(/min-h-\[44px\]/));
  });

  it("shows the brand wordmark linking home (replacing the 5px pill placeholder)", () => {
    renderShell();
    const home = screen.getByRole("link", { name: /Verdé/ });
    expect(home).toHaveAttribute("href", "/");
    // The mark is decorative (aria-hidden) — the wordmark text is the name.
    expect(home.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders the accessible theme toggle (labelled, ≥44px)", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: /Theme:/i });
    expect(toggle.className).toMatch(/h-11 w-11/);
  });

  it("provides the polite + assertive aria-live regions", () => {
    renderShell();
    expect(screen.getByTestId("live-region-polite")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(screen.getByTestId("live-region-assertive")).toHaveAttribute(
      "aria-live",
      "assertive",
    );
  });

  it("renders a `<md`-only menu button with correct ARIA (collapsed by default)", () => {
    renderShell();
    const trigger = screen.getByRole("button", {
      name: /Open navigation menu/i,
    });
    // Hidden at md and up; the inline nav covers that range.
    expect(trigger.className).toMatch(/md:hidden/);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
    // ≥44px target preserved.
    expect(trigger.className).toMatch(/min-h-\[44px\]/);
    expect(trigger.className).toMatch(/min-w-\[44px\]/);
    // No drawer dialog is mounted while collapsed.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the inline nav cluster present but gated to md+ (hidden on mobile/tablet)", () => {
    renderShell();
    const inlineNav = screen.getByRole("navigation", { name: /^Primary$/i });
    // The inline nav lives inside a `hidden md:flex` cluster — present in the DOM
    // for AT, shown only at md and up.
    const cluster = inlineNav.closest("div");
    expect(cluster?.className).toMatch(/hidden/);
    expect(cluster?.className).toMatch(/md:flex/);
  });

  it("opens an accessible focus-trapped drawer that moves focus in, traps Tab, and toggles aria-expanded", async () => {
    renderShell();
    const trigger = screen.getByRole("button", {
      name: /Open navigation menu/i,
    });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /Menu/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Focus moved into the panel (close button).
    const close = within(dialog).getByRole("button", {
      name: /Close navigation menu/i,
    });
    await waitFor(() => expect(close).toHaveFocus());

    // The same five primary links are inside the drawer.
    const drawerNav = within(dialog).getByRole("navigation", {
      name: /Primary \(mobile\)/i,
    });
    const links = within(drawerNav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/log",
      "/insights",
      "/coach",
      "/goal",
    ]);
    // ≥44px target preserved on every drawer link.
    links.forEach((l) => expect(l.className).toMatch(/min-h-\[44px\]/));

    // Tab trap: from the LAST focusable, Tab wraps to the FIRST (close button).
    const focusables = within(dialog).getAllByRole("button").concat(links);
    // The drawer also contains the ThemeToggle button; the close button is first.
    const last = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const lastEl = last[last.length - 1]!;
    lastEl.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    // close + 5 nav links + ThemeToggle = 7 focusables in the drawer.
    expect(focusables.length).toBeGreaterThanOrEqual(7);
  });

  it("closes the drawer on Escape and RETURNS focus to the trigger", async () => {
    renderShell();
    const trigger = screen.getByRole("button", {
      name: /Open navigation menu/i,
    });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: /Menu/i });

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
