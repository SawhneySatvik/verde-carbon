// Capture the populated insights/goal walkthrough + the coach (with a reply).
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3300";
const OUT = "design-review";
fs.mkdirSync(OUT, { recursive: true });
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
  throw new Error("server not ready");
}

await waitForServer(BASE);
const browser = await chromium.launch();
for (const theme of themes) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    colorScheme: theme,
    reducedMotion: "reduce",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  // seed
  try {
    await page.goto(BASE + "/dashboard", { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(2000);
    const seedBtn = page.getByRole("button", { name: /load sample data/i });
    if (await seedBtn.isVisible().catch(() => false)) {
      await seedBtn.click();
      await page
        .waitForResponse((r) => r.url().includes("/api/dev/seed") && r.ok(), {
          timeout: 20000,
        })
        .catch(() => {});
      await page.waitForTimeout(2500);
    }
  } catch (e) {
    console.log("seed failed", theme, String(e).slice(0, 120));
  }

  for (const [name, path] of [
    ["insights", "/insights"],
    ["goal", "/goal"],
  ]) {
    await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
    await page
      .waitForLoadState("networkidle", { timeout: 12000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: `${OUT}/${name}-pop-${theme}.png`,
      fullPage: true,
    });
    console.log("shot", `${name}-pop-${theme}`);
  }

  // coach: ask a suggested prompt and capture the reply
  try {
    await page.goto(BASE + "/coach", { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(1500);
    const chip = page
      .getByRole("button", { name: /biggest lever|cut transport|reduce/i })
      .first();
    if (await chip.isVisible().catch(() => false)) {
      await chip.click();
      await page
        .waitForResponse((r) => r.url().includes("/api/coach"), {
          timeout: 15000,
        })
        .catch(() => {});
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: `${OUT}/coach-${theme}.png`,
      fullPage: true,
    });
    console.log("shot", `coach-${theme}`);
  } catch (e) {
    console.log("coach failed", theme, String(e).slice(0, 120));
  }

  await ctx.close();
}
await browser.close();
console.log("done");
