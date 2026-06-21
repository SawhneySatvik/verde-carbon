import { defineConfig, devices } from "@playwright/test";

// Port is configurable so a local run can sidestep a stray dev/preview server on
// the default port (the Next.js app under test must be the server Playwright
// talks to — never a static file server). Defaults to 3000 for CI.
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Build + start the real Next.js app on the chosen port with the local
    // adapter set (APP_ENV=local: mock auth, in-mem data, recorded-AI fixtures).
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    // Reuse an existing server only when it is genuinely our app (CI always
    // starts fresh). A leftover preview server can otherwise hijack the port.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      APP_ENV: "local",
      PORT: String(PORT),
    },
  },
});
