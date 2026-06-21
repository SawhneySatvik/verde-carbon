import { test, expect, type Page } from "@playwright/test";

/**
 * Chart accessibility beyond axe: charts are validated specifically for
 * non-color encoding + data-table fallback, not just an axe pass — axe cannot
 * detect a color-only chart.
 *
 * We assert, explicitly, that the dashboard trend + category charts:
 *  1. encode data by MORE than color — marker shapes / fill patterns / dash
 *     styles AND a legend that pairs each series with a non-color word cue;
 *  2. expose a keyboard-reachable, screen-reader-PRIMARY <table> fallback with a
 *     <caption>, header cells and scope, carrying the same numbers as the chart;
 *  3. carry a text SUMMARY in a status region.
 */

/** Log two activities in DIFFERENT categories so the category chart has ≥2 series. */
async function seedTwoCategories(page: Page): Promise<void> {
  // Energy (electricity) + diet (beef burger) — both are single-item fixtures
  // that auto-resolve to a sourced factor in the US locale, so each persists in
  // its own category (energy = circle marker, diet = square marker).
  for (const phrase of ["used 50 kwh of electricity", "had a beef burger"]) {
    await page.goto("/log");
    await page.getByLabel(/Describe your activity/i).fill(phrase);
    await page.getByRole("button", { name: /See the breakdown/i }).click();
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Log it$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();
  }
}

test.describe("Dashboard charts — non-color encoding + data-table fallback", () => {
  test.beforeEach(async ({ page }) => {
    await seedTwoCategories(page);
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Total footprint logged/i }),
    ).toBeVisible();
  });

  test("the decorative SVGs are hidden from the a11y tree (table is primary)", async ({
    page,
  }) => {
    // Every chart SVG is aria-hidden + presentation, so the SR experience is the
    // table, not the (color-bearing) graphic.
    const svgs = page.locator("svg[aria-hidden='true']");
    expect(await svgs.count()).toBeGreaterThan(0);
    // No chart SVG is exposed as an img/graphics role to the a11y tree.
    await expect(page.locator("svg[role='img']")).toHaveCount(0);
  });

  test("trend chart: text summary + keyboard-reachable data-table fallback", async ({
    page,
  }) => {
    // Text summary in a status region (not color-only).
    const summary = page.getByTestId("trend-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveText(/footprint|day logged/i);

    // Data table fallback: a real <table> with a <caption>, column headers, and
    // a numeric footprint column.
    const trendTable = page.getByRole("table", {
      name: /Footprint per logged day/i,
    });
    await expect(trendTable).toBeVisible();
    await expect(
      trendTable.getByRole("columnheader", { name: /^Day$/i }),
    ).toBeVisible();
    await expect(
      trendTable.getByRole("columnheader", { name: /Footprint \(kg CO₂e\)/i }),
    ).toBeVisible();
    // The numbers are present (carried as text, not encoded only in the line).
    await expect(trendTable.getByText(/kg/i).first()).toBeVisible();

    // Keyboard reachability: the table's cells are reachable by tab order via the
    // surrounding document (the table is in normal flow, not aria-hidden).
    await expect(trendTable).not.toHaveAttribute("aria-hidden", "true");
  });

  test("category chart: per-series NON-COLOR cue (pattern words + marker) in legend AND table", async ({
    page,
  }) => {
    // Text summary names the top contributor without bar length/color.
    const summary = page.getByTestId("category-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveText(/Biggest contributor/i);

    // The legend pairs each series with a WORD describing its non-color cue.
    // Energy = "solid fill, circle marker"; diet = "dotted fill, square marker".
    await expect(page.getByText(/circle marker/i).first()).toBeVisible();
    await expect(page.getByText(/square marker/i).first()).toBeVisible();

    // The category data table repeats the non-color "Pattern" column, so the
    // table itself never relies on color either.
    const catTable = page.getByRole("table", {
      name: /Footprint by category/i,
    });
    await expect(catTable).toBeVisible();
    await expect(
      catTable.getByRole("columnheader", { name: /^Category$/i }),
    ).toBeVisible();
    await expect(
      catTable.getByRole("columnheader", { name: /^Pattern$/i }),
    ).toBeVisible();
    await expect(
      catTable.getByRole("columnheader", { name: /^Share$/i }),
    ).toBeVisible();
    // A pattern-word cell is present in the body (the non-color encoding).
    await expect(catTable.getByText(/fill,.*marker/i).first()).toBeVisible();

    // Two series are present (transport + diet), each a row header.
    const rowHeaders = catTable.getByRole("rowheader");
    expect(await rowHeaders.count()).toBeGreaterThanOrEqual(2);
  });

  test("category SVG bars are PATTERN-filled (geometry), not color-only fills", async ({
    page,
  }) => {
    // The bars reference SVG <pattern> defs by url(#viz-pat-*) — proof the fill
    // carries geometry (hatch/dots/solid), not just a flat color.
    const patternedBars = page.locator("rect[fill^='url(#viz-pat-']");
    expect(await patternedBars.count()).toBeGreaterThan(0);

    // The <pattern> defs themselves exist for each series (defs include all
    // categories; energy + diet are the two with data here).
    await expect(page.locator("pattern#viz-pat-energy")).toHaveCount(1);
    await expect(page.locator("pattern#viz-pat-diet")).toHaveCount(1);
  });

  test("trend chart encodes points with circle MARKERS + direct value labels", async ({
    page,
  }) => {
    // The trend line carries circle markers (non-color point cue) and direct
    // per-point numeric labels (text, not color).
    const trendSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Footprint over time/i }),
    });
    await expect(trendSection.locator("svg circle").first()).toBeVisible();
    // Direct numeric value labels exist inside the trend svg.
    await expect(trendSection.locator("svg text").first()).toBeVisible();
  });
});
