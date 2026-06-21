import { test, expect, type Page, type Request } from "@playwright/test";

/**
 * "Show before save" + partial-resolve + zero-GCP e2e.
 *
 * The trust contract: parse → compute (client preview) → DISPLAY the
 * per-item/total CO2e with ZERO persisted writes until the user clicks "Log it".
 * We count POST /api/activities requests WITHOUT ?preview=1 and assert there are
 * 0 before confirm and exactly 1 after.
 *
 * Partial-resolve: a 2-item parse where one item is UNSOURCED totals ONLY
 * the sourced item end-to-end and persists correctly (unsourced excluded).
 *
 * Zero-GCP: the local run makes NO network requests to any GCP host
 * (googleapis.com / firestore / firebase / generativelanguage). The whole loop
 * runs on local adapters.
 *
 * Phrases come from the recorded parse fixture
 * (src/server/adapters/local/fixtures/parse.json).
 */

const GCP_HOST_RE =
  /(googleapis\.com|firestore|firebaseio|firebaseapp|identitytoolkit|securetoken|generativelanguage|google-analytics|gstatic\.com\/firebasejs)/i;

/** True for a REAL persisting write: POST /api/activities WITHOUT ?preview. */
function isPersistWrite(req: Request): boolean {
  if (req.method() !== "POST") return false;
  const url = req.url();
  return url.includes("/api/activities") && !/[?&]preview/.test(url);
}

/** Attach a recorder that collects every outbound request URL + persist writes. */
function recordNetwork(page: Page): {
  persistWrites: Request[];
  allUrls: string[];
} {
  const persistWrites: Request[] = [];
  const allUrls: string[] = [];
  page.on("request", (req) => {
    allUrls.push(req.url());
    if (isPersistWrite(req)) {
      persistWrites.push(req);
    }
  });
  return { persistWrites, allUrls };
}

test.describe("show before save (zero writes until 'Log it')", () => {
  test("parse → compute → display with ZERO persist writes; exactly 1 on confirm", async ({
    page,
  }) => {
    const net = recordNetwork(page);

    await page.goto("/log");
    await page
      .getByLabel(/Describe your activity/i)
      .fill("used 50 kwh of electricity");
    await page.getByRole("button", { name: /See the breakdown/i }).click();

    // The breakdown is DISPLAYED (computed by the client preview) — per-item +
    // total CO2e and the factor source are visible.
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await expect(page.getByText(/kg CO₂e/i).first()).toBeVisible();
    // "Show the math" exposes the factor + source (provenance).
    await expect(
      page.getByRole("button", { name: /Show the math/i }).first(),
    ).toBeVisible();

    // CRITICAL: a parse + preview happened, but NOTHING has persisted yet.
    expect(
      net.persistWrites.length,
      "no non-preview POST /api/activities before confirm",
    ).toBe(0);

    // Confirm — the first and only persist write.
    await page.getByRole("button", { name: /^Log it$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();

    expect(
      net.persistWrites.length,
      "exactly one persist write after 'Log it'",
    ).toBe(1);
  });

  test("cancelling after preview persists NOTHING", async ({ page }) => {
    const net = recordNetwork(page);

    await page.goto("/log");
    await page.getByLabel(/Describe your activity/i).fill("had a beef burger");
    await page.getByRole("button", { name: /See the breakdown/i }).click();
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Cancel$/i }).click();
    // Back to the idle NL field, and not a single persist write occurred.
    await expect(page.getByLabel(/Describe your activity/i)).toBeVisible();
    expect(net.persistWrites.length).toBe(0);
  });
});

test.describe("partial resolve (one unsourced item)", () => {
  test("a 2-item parse with one UNSOURCED item totals only the sourced item and persists it", async ({
    page,
  }) => {
    // Fixture "had a beef burger and a unicorn steak": beef → sourced
    // (diet.meal.beef), unicorn → UNSOURCED (diet.meal.unknown, not in vocab).
    await page.goto("/log");
    await page
      .getByLabel(/Describe your activity/i)
      .fill("had a beef burger and a unicorn steak");
    await page.getByRole("button", { name: /See the breakdown/i }).click();

    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();

    // The unsourced item shows the candidate-factor picker (a reason, not a
    // guessed number) and "Log it" is BLOCKED until it is resolved.
    await expect(page.getByText(/couldn.?t match a source/i)).toBeVisible();
    const logIt = page.getByRole("button", { name: /^Log it$/i });
    await expect(logIt).toBeDisabled();
    // The total at this point is labelled "sourced items only" and equals ONLY
    // the beef item's CO2e (1 beef meal at the seeded factor ≈ 6.61 kg) — the
    // unsourced unicorn item is NOT folded into the total.
    await expect(page.getByText(/sourced items only/i)).toBeVisible();
    await expect(page.getByText(/6\.61/).first()).toBeVisible();

    // Resolve the unsourced item by picking a real factor — now save unblocks.
    // (Use click, not check: picking a factor resolves the item and unmounts the
    // picker, so the radio's post-click "checked" state can't be re-read.)
    await page.getByRole("radio", { name: /Beef \/ red-meat meal/i }).click();
    await expect(logIt).toBeEnabled();

    // Persist; the saved confirmation shows a real total (sourced items).
    await logIt.click();
    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();
    // The saved total carries the kg CO₂e figure (calculator-sourced).
    await expect(page.getByText(/kg CO₂e/i).first()).toBeVisible();
  });

  test("partial-resolve persists ONLY the sourced item when the unsourced one is left unresolved via the API", async ({
    page,
  }) => {
    // Drive the partial-resolve totalling rule through the API directly
    // (end-to-end at the handler boundary): one sourced + one unsourced item ->
    // the response totals only the sourced item and marks the result partial.
    await page.goto("/dashboard");
    // Wait until the dashboard reaches a SUCCESSFUL state (fresh context → empty
    // state) — proof the anon session is established and window.fetch is patched
    // with the bearer — before issuing the raw API call below.
    await expect(
      page.getByRole("heading", { name: /Nothing logged yet/i }),
    ).toBeVisible();
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale: "US",
          origin: "nl",
          items: [
            {
              category: "diet",
              activity: "beef burger",
              value: 1,
              unit: "meal",
              candidateFactorKey: "diet.meal.beef",
            },
            {
              category: "diet",
              activity: "unicorn steak",
              value: 1,
              unit: "meal",
              candidateFactorKey: "diet.meal.unknown",
            },
          ],
        }),
      });
      return res.json();
    });

    // Sourced item persisted; unsourced excluded; total reflects the sourced
    // item only; partial flag set.
    expect(result.partial).toBe(true);
    expect(result.persisted).toHaveLength(1);
    expect(result.persisted[0].activity).toMatch(/beef/i);
    expect(result.unsourced).toHaveLength(1);
    expect(result.unsourced[0].activity).toMatch(/unicorn/i);
    expect(result.totalKg).toBeGreaterThan(0);
    // The total equals exactly the one sourced item's co2e (no unsourced number
    // folded in).
    expect(result.totalKg).toBeCloseTo(result.persisted[0].co2eKg, 6);
  });
});

test.describe("zero GCP network calls in the local run", () => {
  test("the full log → dashboard loop makes NO request to any GCP host", async ({
    page,
  }) => {
    const net = recordNetwork(page);

    // Exercise the parse + persist + dashboard read path.
    await page.goto("/log");
    await page
      .getByLabel(/Describe your activity/i)
      .fill("used 50 kwh of electricity");
    await page.getByRole("button", { name: /See the breakdown/i }).click();
    await expect(
      page.getByRole("heading", { name: /Check this before you save/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Log it$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Logged — added to your dashboard/i }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Total footprint logged/i }),
    ).toBeVisible();

    await page.goto("/insights");
    await expect(
      page.getByRole("heading", { level: 1, name: /Ranked insights/i }),
    ).toBeVisible();

    const gcpCalls = net.allUrls.filter((u) => GCP_HOST_RE.test(u));
    expect(
      gcpCalls,
      `local run must make zero GCP network calls; saw: ${gcpCalls.join(", ")}`,
    ).toEqual([]);
  });
});
