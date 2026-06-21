// Design-review screenshotter. Captures key screens in light + dark,
// seeding sample data so the dashboard/insights/goal render populated.
// Usage: node scripts/screenshot-review.mjs   (expects a server on $BASE)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3300";
const OUT = "design-review";
fs.mkdirSync(OUT, { recursive: true });

// no-data routes captured directly
const staticRoutes = [
  ["welcome", "/"],
  ["how-it-works", "/how-it-works"],
  ["wizard", "/wizard"],
  ["log", "/log"],
  ["account", "/link"],
  ["settings", "/settings"],
];
// data-dependent routes captured after seeding
const seededRoutes = [
  ["dashboard", "/dashboard"],
  ["insights", "/insights"],
  ["goal", "/goal"],
];
const themes = ["light", "dark"];

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("server not ready: " + url);
}

async function shoot(page, name, path, theme) {
  try {
    await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${OUT}/${name}-${theme}.png`,
      fullPage: true,
    });
    console.log("shot", `${name}-${theme}`);
  } catch (e) {
    console.log("FAILED", `${name}-${theme}`, String(e).slice(0, 140));
  }
}

console.log("waiting for", BASE);
await waitForServer(BASE);
for (const [, p] of [...staticRoutes, ...seededRoutes]) {
  try {
    await fetch(BASE + p);
  } catch {}
}

const browser = await chromium.launch();
for (const theme of themes) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 940 },
    colorScheme: theme,
    reducedMotion: "reduce",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // seed sample data via the dashboard empty-state button so the anon session
  // (minted client-side) owns the data, then capture the populated screens
  try {
    await page.goto(BASE + "/dashboard", { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(2000); // let SessionBootstrap mint the anon token
    const seedBtn = page.getByRole("button", { name: /load sample data/i });
    if (await seedBtn.isVisible().catch(() => false)) {
      await seedBtn.click();
      // wait for the populated dashboard (hero footprint figure / charts)
      await page
        .waitForResponse((r) => r.url().includes("/api/dev/seed") && r.ok(), {
          timeout: 20000,
        })
        .catch(() => {});
      await page.waitForTimeout(2500);
    }
  } catch (e) {
    console.log("seed step failed", theme, String(e).slice(0, 140));
  }

  for (const [name, path] of staticRoutes) await shoot(page, name, path, theme);
  for (const [name, path] of seededRoutes) await shoot(page, name, path, theme);

  await ctx.close();
}
await browser.close();
console.log("done ->", OUT);
