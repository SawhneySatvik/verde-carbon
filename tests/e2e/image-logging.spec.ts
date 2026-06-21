import { test, expect, type Page, type Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Image-logging e2e ("Snap a photo" → parse → show-before-save → logged).
 *
 * Proves the image path reuses the SAME trust contract as the NL path:
 *  - open the "Snap a photo" tab → click a bundled sample → the recorded image
 *    fixture is parsed (deterministic, network-free, hash-keyed) and the parsed
 *    items appear in the SAME ParseConfirmation breakdown;
 *  - ZERO non-preview POST /api/activities until the user clicks "Log it"
 *    (the user-confirm gate is preserved for images);
 *  - exactly ONE persist write after "Log it"; the activity then shows on the
 *    dashboard;
 *  - the photo surface is axe-clean (WCAG 2.2 AA, zero serious/critical).
 *
 * The samples (public/samples/*.png) hash to the recorded image-parse fixtures
 * (src/server/adapters/local/fixtures/image-parse.json), so the meal sample
 * parses to a single sourced "beef burger" item — fully sourceable, so "Log it"
 * is enabled without a factor pick.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** True for a REAL persisting write: POST /api/activities WITHOUT ?preview. */
function isPersistWrite(req: Request): boolean {
  if (req.method() !== "POST") return false;
  const url = req.url();
  return url.includes("/api/activities") && !/[?&]preview/.test(url);
}

function recordPersistWrites(page: Page): Request[] {
  const writes: Request[] = [];
  page.on("request", (req) => {
    if (isPersistWrite(req)) writes.push(req);
  });
  return writes;
}

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

test.describe("image logging (snap a photo → show before save → logged)", () => {
  test("a sample photo parses into ParseConfirmation; ZERO persist writes until 'Log it', then exactly one", async ({
    page,
  }) => {
    const persistWrites = recordPersistWrites(page);

    await page.goto("/log");

    // Switch to the "Snap a photo" tab (WAI-ARIA tab).
    await page.getByRole("tab", { name: /Snap a photo/i }).click();
    await expect(
      page.getByRole("heading", { name: /Log from a photo/i }),
    ).toBeVisible();

    // Click a bundled sample → deterministic recorded image parse.
    await page.getByRole("button", { name: /Beef burger meal/i }).click();

    // The parsed item lands in the SAME ParseConfirmation breakdown.
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Activity$/i)).toHaveValue(/beef burger/i);
    await expect(page.getByText(/kg CO₂e/i).first()).toBeVisible();

    // CRITICAL: an image parse + client preview happened, but NOTHING persisted.
    expect(
      persistWrites.length,
      "no non-preview POST /api/activities before confirm (image path)",
    ).toBe(0);

    // The user-confirm gate: only "Log it" persists.
    const logIt = page.getByRole("button", { name: /^Log it$/i });
    await expect(logIt).toBeEnabled();
    await logIt.click();

    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();
    expect(
      persistWrites.length,
      "exactly one persist write after 'Log it' (image path)",
    ).toBe(1);

    // The logged activity shows on the dashboard.
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Total footprint logged/i }),
    ).toBeVisible();
  });

  test("the 'Snap a photo' surface is axe-clean (WCAG 2.2 AA)", async ({
    page,
  }) => {
    // Final, opaque state — no mid-animation frame for contrast checks.
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/log");
    await page.getByRole("tab", { name: /Snap a photo/i }).click();
    await expect(
      page.getByRole("heading", { name: /Log from a photo/i }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Log — photo tab");

    // Parse a sample so the ParseConfirmation surface (image-sourced) is also
    // covered in its show-before-save state.
    await page.getByRole("button", { name: /Beef burger meal/i }).click();
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Activity$/i)).toHaveValue(/beef burger/i);
    await expectNoSeriousA11yViolations(page, "Parse Confirmation (image)");
  });

  test("the photo tab uses a real labelled file input (image/*, camera capture)", async ({
    page,
  }) => {
    await page.goto("/log");
    await page.getByRole("tab", { name: /Snap a photo/i }).click();

    const input = page.getByLabel(/Choose a photo to log/i);
    await expect(input).toHaveAttribute("type", "file");
    await expect(input).toHaveAttribute("accept", "image/*");
    await expect(input).toHaveAttribute("capture", "environment");
  });
});
