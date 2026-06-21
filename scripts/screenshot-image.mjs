// Capture the image-logging flow: photo tab + the resulting ParseConfirmation.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3300";
const OUT = "design-review";
fs.mkdirSync(OUT, { recursive: true });

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
const ctx = await browser.newContext({
  viewport: { width: 1100, height: 940 },
  colorScheme: "light",
  reducedMotion: "reduce",
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
try {
  await page.goto(BASE + "/log", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(2000);
  // switch to the photo tab
  const photoTab = page.getByRole("tab", { name: /snap a photo|photo/i });
  if (await photoTab.isVisible().catch(() => false)) {
    await photoTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `${OUT}/image-tab-light.png`,
      fullPage: true,
    });
    console.log("shot image-tab-light");
    // click the first sample image button
    const sample = page
      .getByRole("button", { name: /beef|sample|burger/i })
      .first();
    if (await sample.isVisible().catch(() => false)) {
      await sample.click();
      // wait for ParseConfirmation heading
      await page
        .getByRole("heading", { name: /check this before you save/i })
        .waitFor({ timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `${OUT}/image-confirm-light.png`,
        fullPage: true,
      });
      console.log("shot image-confirm-light");
    } else {
      console.log("no sample button found");
    }
  } else {
    console.log("no photo tab found");
  }
} catch (e) {
  console.log("FAILED", String(e).slice(0, 160));
}
await ctx.close();
await browser.close();
console.log("done");
