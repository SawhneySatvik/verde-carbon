import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility gate: automated axe checks run in CI on every
 * screen — zero serious/critical violations.
 *
 * We run @axe-core/playwright on EVERY screen and surface in distinct
 * states where the design defines them (Parse Confirmation, structured fallback,
 * the dashboard in its ready state). The bar is WCAG 2.2 AA: we
 * tag the WCAG 2.0/2.1/2.2 A + AA rule sets and FAIL on any serious or critical
 * violation. (axe cannot prove color-only encoding — that is asserted explicitly
 * in charts-a11y.spec.ts.)
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Run axe on the current page and assert zero serious/critical violations. */
async function expectNoSeriousA11yViolations(
  page: Page,
  context: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  // Helpful failure output: which rule, where.
  const summary = blocking
    .map(
      (v) =>
        `${v.id} (${v.impact}) — ${v.help}\n  nodes: ${v.nodes
          .map((n) => n.target.join(" "))
          .join(", ")}`,
    )
    .join("\n");

  expect(
    blocking,
    `${context}: serious/critical a11y violations:\n${summary}`,
  ).toEqual([]);
}

test.describe("axe — every screen has zero serious/critical violations", () => {
  // Set reduced motion BEFORE any navigation so the app's `motion-safe:`
  // entrance/transition animations never run — every surface is rendered to its
  // FINAL, opaque state. This keeps axe colour-contrast deterministic (no
  // mid-animation reduced-opacity frame, e.g. the rise-in confirm dialog) and
  // matches the reduced-motion commitment.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("Welcome", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Welcome");
  });

  test("How this works (transparency explainer)", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "How this works");
  });

  test("Onboarding wizard (input step)", async ({ page }) => {
    await page.goto("/wizard");
    await expect(page.getByText(/Step 1 of 4/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Wizard — step 1");
  });

  test("Wizard Review (baseline breakdown)", async ({ page }) => {
    await page.goto("/wizard");
    await page.getByLabel(/Electricity used per month/i).fill("300");
    await page.getByRole("button", { name: /^Next$/i }).click();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Review your baseline/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Wizard — review");
  });

  test("Log Activity (NL entry, idle)", async ({ page }) => {
    await page.goto("/log");
    await expect(page.getByLabel(/Describe your activity/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Log — idle");
  });

  test("Parse Confirmation (show before save)", async ({ page }) => {
    await page.goto("/log");
    await page.getByLabel(/Describe your activity/i).fill("had a beef burger");
    await page.getByRole("button", { name: /See the breakdown/i }).click();
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Parse Confirmation");
  });

  test("Structured Fallback Form", async ({ page }) => {
    await page.goto("/log");
    await page
      .getByRole("button", { name: /Use the structured form instead/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /Log without AI/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Structured Fallback Form");
  });

  test("Dashboard (empty state)", async ({ page }) => {
    await page.goto("/dashboard");
    // Either the empty state or a ready state renders; both must be clean. Wait
    // for the loading skeleton to resolve.
    await expect(
      page.getByRole("heading", { level: 1, name: /Dashboard/i }),
    ).toBeVisible();
    await expect(page.getByText(/Loading dashboard/i)).toHaveCount(0);
    await expectNoSeriousA11yViolations(page, "Dashboard");
  });

  test("Dashboard (ready, with a logged activity + charts)", async ({
    page,
  }) => {
    // Seed one activity so the charts + data tables render, then axe the ready
    // state (where the charts live).
    await page.goto("/log");
    await page
      .getByLabel(/Describe your activity/i)
      .fill("used 50 kwh of electricity");
    await page.getByRole("button", { name: /See the breakdown/i }).click();
    await page.getByRole("button", { name: /^Log it$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Total footprint logged/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Dashboard — ready");
  });

  test("Insights", async ({ page }) => {
    await page.goto("/insights");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranked insights/i }),
    ).toBeVisible();
    await expect(page.getByText(/Loading insights/i)).toHaveCount(0);
    await expectNoSeriousA11yViolations(page, "Insights");
  });

  test("Goal", async ({ page }) => {
    await page.goto("/goal");
    await expect(page.getByLabel(/Reduction target/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Goal");
  });

  test("Coach (conversational, idle)", async ({ page }) => {
    await page.goto("/coach");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ask your coach/i }),
    ).toBeVisible();
    // The composer + the calculator-grounding panel both render.
    await expect(page.getByLabel(/Ask the coach a question/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Grounded in your data/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Coach — idle");
  });

  test("Goal — clear-goal confirm dialog", async ({ page }) => {
    // Create a goal first so the Clear control + confirm dialog exist.
    await page.goto("/goal");
    await page.getByLabel(/Reduction target/i).fill("10");
    await page.getByRole("button", { name: /Save goal/i }).click();
    await page.getByRole("button", { name: /Clear goal/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Goal — confirm dialog");
  });

  test("Account-linking / Sign-in", async ({ page }) => {
    await page.goto("/link");
    await expect(
      page.getByRole("heading", { name: /What carries over/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Account-linking");
  });

  test("Account-linking — email & password fields", async ({ page }) => {
    await page.goto("/link");
    await page.getByRole("radio", { name: /Email & password/i }).check();
    await expect(page.getByLabel(/^Email$/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Account-linking — password");
  });

  test("Settings (units & factor set)", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: /Settings/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Settings");
  });
});

/**
 * Mobile-viewport accessibility (responsive pass). Below sm (≤640px) the inline
 * primary nav is replaced by the focus-trapped MobileNavDrawer. At a 375px
 * viewport we assert:
 *  - the open drawer has zero serious/critical axe violations,
 *  - `aria-expanded` toggles on the trigger,
 *  - focus moves INTO the drawer on open,
 *  - the focus trap wraps (Tab from the last focusable returns to the first),
 *  - Esc closes the drawer AND returns focus to the trigger.
 */
test.describe("mobile nav drawer — 375px viewport a11y", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("trigger exposes aria-expanded and aria-controls", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /Open navigation menu/i });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    const controls = await trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
  });

  test("opening the drawer is axe-clean and moves focus inside", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /Open navigation menu/i });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: /Menu/i });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Focus moved into the panel (onto the close button).
    const closeBtn = page.getByRole("button", {
      name: /Close navigation menu/i,
    });
    await expect(closeBtn).toBeFocused();

    // The same five primary links live inside the drawer.
    const links = dialog.getByRole("link");
    await expect(links).toHaveCount(5);

    await expectNoSeriousA11yViolations(page, "Mobile nav drawer — open");
  });

  test("Tab is trapped within the drawer (wraps last → first)", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /Open navigation menu/i });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: /Menu/i });
    await expect(dialog).toBeVisible();

    // The ThemeToggle hydrates from an inert placeholder into a real button;
    // wait for it so the focusable set is stable before exercising the trap.
    await expect(dialog.getByRole("button", { name: /Theme:/i })).toBeVisible();

    // Focusables in order: close, 5 nav links, ThemeToggle = 7.
    const focusables = dialog.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    await expect(focusables).toHaveCount(7);
    const count = await focusables.count();

    // From the LAST focusable, Tab must wrap back to the FIRST (the close btn).
    await focusables.nth(count - 1).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: /Close navigation menu/i }),
    ).toBeFocused();

    // Shift+Tab from the first wraps to the last.
    await page.keyboard.press("Shift+Tab");
    await expect(focusables.nth(count - 1)).toBeFocused();
  });

  test("Esc closes the drawer and returns focus to the trigger", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: /Open navigation menu/i });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: /Menu/i })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog", { name: /Menu/i })).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("scrim click closes the drawer", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /Open navigation menu/i });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: /Menu/i })).toBeVisible();

    // Click the scrim (top-left corner, away from the right-edge panel).
    await page.mouse.click(20, 20);

    await expect(page.getByRole("dialog", { name: /Menu/i })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
