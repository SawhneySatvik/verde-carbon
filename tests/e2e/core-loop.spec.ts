import { test, expect, type Page } from "@playwright/test";

/**
 * Anonymous core-loop e2e, against the LOCAL adapter set
 * (APP_ENV=local: mock anon auth, in-mem data, recorded-AI-fixture player).
 *
 * The spine of the product, end-to-end, with no account at any step:
 *   Welcome → onboarding wizard → baseline → NL log (show-before-save) →
 *   dashboard updates → insights → set a goal / see streak →
 *   sign-in account-linking with NO data loss.
 *
 * Phrases used for NL logging MUST exist in the recorded parse fixture
 * (src/server/adapters/local/fixtures/parse.json) AND auto-resolve to a sourced
 * factor in the page's US locale. "used 50 kwh of electricity"
 * (energy.electricity.grid) and "had a beef burger" (diet.meal.beef) both
 * resolve cleanly; distance-based driving is priced per gallon in the seed, so
 * "drove …" is genuinely unsourced until the user picks a factor (exercised in
 * show-before-save.spec.ts's partial-resolve test). We only use fixture phrases
 * so the recorded player resolves them deterministically (no live AI).
 */

/**
 * Log one NL activity through the load-bearing "show before save" surface and
 * confirm it persists. Returns once the success state is shown.
 */
async function logActivity(page: Page, phrase: string): Promise<void> {
  await page.goto("/log");
  const field = page.getByLabel(/Describe your activity/i);
  await field.fill(phrase);
  await page.getByRole("button", { name: /See the breakdown/i }).click();

  // Parse Confirmation appears — computed by the client preview, nothing saved.
  await expect(
    page.getByRole("heading", { name: /Check this before you save/i }),
  ).toBeVisible();

  // Confirm — the ONLY persistence write.
  const logIt = page.getByRole("button", { name: /^Log it$/i });
  await expect(logIt).toBeEnabled();
  await logIt.click();

  await expect(
    page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
  ).toBeVisible();
}

test.describe("Anonymous core loop (local adapters)", () => {
  test("Welcome → wizard → baseline → NL log → dashboard → insights → goal → link, no data loss", async ({
    page,
  }) => {
    // 1. Welcome — anonymous entry, the honesty promise, no sign-in wall.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /carbon footprint/i }),
    ).toBeVisible();
    // The persistent anonymous banner is present.
    await expect(
      page.getByRole("region", { name: /Account status/i }),
    ).toContainText(/exploring anonymously/i);

    // 2. Start the onboarding wizard.
    await page.getByRole("link", { name: /Estimate my footprint/i }).click();
    await expect(page).toHaveURL(/\/wizard$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Estimate your footprint/i }),
    ).toBeVisible();
    await expect(page.getByText(/Step 1 of 4/i)).toBeVisible();

    // 3. Enter a baseline figure on step 1 (Home energy → electricity).
    await page.getByLabel(/Electricity used per month/i).fill("300");

    // Advance to the Review step.
    await page.getByRole("button", { name: /^Next$/i }).click(); // → Transport
    await page.getByRole("button", { name: /^Next$/i }).click(); // → Diet
    await page.getByRole("button", { name: /^Next$/i }).click(); // → Review

    // 4. Review (baseline): a real breakdown table computed by the calculator.
    await expect(
      page.getByRole("heading", { name: /Review your baseline/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: /baseline footprint/i }),
    ).toBeVisible();

    // 5. See my dashboard — completes onboarding, no account required.
    await page.getByRole("link", { name: /See my dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 6. NL log with show-before-save (fixture phrase that auto-resolves).
    //    After confirming it appears on the dashboard.
    await logActivity(page, "used 50 kwh of electricity");

    // 7. Dashboard reflects the logged activity (total > 0, charts + tables).
    await page.goto("/dashboard");
    const total = page.getByRole("heading", {
      name: /Total footprint logged/i,
    });
    await expect(total).toBeVisible();
    // The dashboard is in its READY state (not empty / error): the trend +
    // category chart data tables are present.
    await expect(page.getByRole("table")).toHaveCount(2);
    // The total is a real, non-zero number computed from the stored co2eKg.
    const totalSection = page.locator("section").filter({ has: total }).first();
    await expect(totalSection).not.toContainText(/0\.00\s*kg/i);

    // 8. Insights — ranked, calculator-sourced (or the explicit "log more" empty
    //    state). Either way the screen renders without error.
    await page.goto("/insights");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranked insights/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Couldn.?t load insights/i }),
    ).toHaveCount(0);

    // 9. Set a goal + see the streak.
    await page.goto("/goal");
    const target = page.getByLabel(/Reduction target/i);
    await target.fill("10");
    await page.getByRole("button", { name: /Save goal/i }).click();
    await expect(
      page.getByRole("heading", { name: /How your streak works/i }),
    ).toBeVisible();
    // The streak rule is explained in TEXT (not color-only).
    await expect(
      page.getByText(/counts each calendar day you log/i),
    ).toBeVisible();

    // 10. Account-linking — sign in and verify NO data loss (the uid is
    //     preserved on the happy path, so the dashboard total survives).
    await page.goto("/link");
    await expect(
      page.getByRole("heading", { name: /What carries over/i }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Continue with Google/i }).check();
    await page.getByRole("button", { name: /Save my data/i }).click();
    await expect(
      page.getByRole("heading", { name: /Saved and synced/i }),
    ).toBeVisible();

    // 11. Back to the dashboard — the previously-logged data is still there.
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Total footprint logged/i }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: /Nothing logged yet/i }),
    ).toHaveCount(0);
  });

  test("structured fallback logs without AI (loop never blocks)", async ({
    page,
  }) => {
    await page.goto("/log");
    // Drop straight into the structured fallback form (reachable directly).
    await page
      .getByRole("button", { name: /Use the structured form instead/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /Log without AI/i }),
    ).toBeVisible();

    await page.getByLabel(/^Category$/i).selectOption("energy");
    await page
      .getByLabel(/^Activity$/i)
      .selectOption("energy.electricity.grid");
    await page.getByLabel(/^Quantity/i).fill("50");
    await page.getByRole("button", { name: /Preview CO₂e/i }).click();

    // Same Parse Confirmation breakdown + same calculator.
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Log it$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();
  });
});
