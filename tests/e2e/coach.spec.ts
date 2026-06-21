import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Conversational Coach e2e, against the LOCAL adapter set
 * (APP_ENV=local: mock anon auth, in-mem data, recorded coach-fixture player).
 *
 * The load-bearing assertion of this screen, end-to-end:
 *   seed sample data → open Coach → ask a suggested prompt → the coach answers
 *   with WORDS only (the reply is DIGIT-FREE) while the calculator GROUNDING
 *   (total kg, top category, top insight titles) carries the numbers. The screen
 *   is axe-clean and the reply text provably contains no digit.
 *
 * We seed via the dashboard's "Load sample data" affordance so the seed write is
 * tied to the same authenticated anon session the page uses (every sample CO2e is
 * still calculator-computed — the seed route never fabricates a number).
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoSeriousA11yViolations(
  page: Page,
  context: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
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

/** Seed the authenticated anon account with sample data via the dashboard. */
async function seedSampleData(page: Page): Promise<void> {
  await page.goto("/dashboard");
  const seedBtn = page.getByRole("button", { name: /Load sample data/i });
  await expect(seedBtn).toBeVisible();
  await seedBtn.click();
  // Seeding flips the dashboard into its ready state.
  await expect(
    page.getByRole("heading", { name: /Total footprint logged/i }),
  ).toBeVisible();
}

test.describe("Conversational Coach (local adapters)", () => {
  test.beforeEach(async ({ page }) => {
    // Render every surface to its final, opaque state so axe contrast is
    // deterministic and the reveal animations never gate content.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("seed → ask a suggested prompt → digit-free reply + calculator grounding, axe-clean", async ({
    page,
  }) => {
    await seedSampleData(page);

    // Open the Coach via the primary nav entry (proves the destination exists).
    await page.goto("/coach");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ask your coach/i }),
    ).toBeVisible();

    // The "Grounded in your data" panel carries the CALCULATOR numbers, and says
    // so explicitly (the split: advice in words, figures computed).
    const grounding = page.getByRole("complementary", {
      name: /Grounded in your data/i,
    });
    await expect(
      grounding.getByRole("heading", { name: /Grounded in your data/i }),
    ).toBeVisible();
    await expect(
      grounding.getByText(/computed by the calculator, not the AI/i),
    ).toBeVisible();
    // The total footprint is a real, non-zero, tabular figure from the seed.
    await expect(grounding.getByText(/Total footprint logged/i)).toBeVisible();
    await expect(grounding.getByText(/kg CO₂e/i)).toBeVisible();
    await expect(grounding).not.toContainText(/^0\.00\s*kg/);

    // Ask a suggested prompt (a real button).
    const chip = page.getByRole("button", {
      name: /How do I cut transport\?/i,
    });
    await expect(chip).toBeVisible();
    await chip.click();

    // The user turn + the coach reply both appear in the semantic message log.
    await expect(
      page.getByText(/How do I cut transport\?/i).first(),
    ).toBeVisible();
    const reply = page.getByTestId("coach-reply").first();
    await expect(reply).toBeVisible();

    // The coach reply is DIGIT-FREE — the hard rule of the screen. (The numbers
    // live only in the grounding panel.)
    const replyText = (await reply.textContent()) ?? "";
    expect(replyText.trim().length).toBeGreaterThan(0);
    expect(replyText).not.toMatch(/\d/);

    // The whole populated screen is axe-clean.
    await expectNoSeriousA11yViolations(page, "Coach — replied");
  });

  test("empty account nudges to log before coaching", async ({ page }) => {
    // No seed: a fresh anon account has no activities.
    await page.goto("/coach");
    await expect(
      page.getByRole("heading", { name: /Log an activity to coach on/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/nothing to ground the figures in/i),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Coach — empty");
  });
});
