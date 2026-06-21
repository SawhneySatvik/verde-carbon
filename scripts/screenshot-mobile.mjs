// Mobile design-review screenshotter (390x844). Seeds sample data, captures
// key screens + the open nav drawer, light + dark.
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3300";
const OUT = "design-review";
fs.mkdirSync(OUT, { recursive: true });
const VP = { width: 390, height: 844 };

const routes = [
  ["welcome", "/"],
  ["log", "/log"],
  ["dashboard", "/dashboard"],
  ["insights", "/insights"],
  ["settings", "/settings"],
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

await waitForServer(BASE);
const browser = await chromium.launch();
for (const theme of themes) {
  const ctx = await browser.newContext({
    viewport: VP,
    colorScheme: theme,
    reducedMotion: "reduce",
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // seed so dashboard/insights are populated
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

  for (const [name, path] of routes) {
    try {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
      await page
        .waitForLoadState("networkidle", { timeout: 12000 })
        .catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `${OUT}/m-${name}-${theme}.png`,
        fullPage: true,
      });
      console.log("shot", `m-${name}-${theme}`);
    } catch (e) {
      console.log("FAILED", name, theme, String(e).slice(0, 120));
    }
  }

  // capture the open mobile nav drawer (light only)
  if (theme === "light") {
    try {
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(1000);
      const menu = page.getByRole("button", { name: /open navigation menu/i });
      if (await menu.isVisible().catch(() => false)) {
        await menu.click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/m-drawer-light.png` });
        console.log("shot", "m-drawer-light");
      }
    } catch (e) {
      console.log("drawer shot failed", String(e).slice(0, 120));
    }
  }

  await ctx.close();
}
await browser.close();
console.log("done ->", OUT);
