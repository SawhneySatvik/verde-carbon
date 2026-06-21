import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";

const alias = {
  "@core": fileURLToPath(new URL("./packages/core", import.meta.url)),
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

// Two projects so the server/core suite keeps the fast node environment while
// the App-Router component tests get a jsdom DOM + React plugin + jest-dom
// matchers. Tests are partitioned by path: anything under `src/app/**` that is a
// component (not an API route) renders in jsdom; everything else runs in node.
export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["packages/core/**", "src/server/**"],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "**/*.d.ts"],
    },
    projects: [
      {
        // Node project: pure core, server adapters/http, and API route handlers.
        resolve: { alias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          include: [
            "packages/**/*.{test,spec}.{ts,tsx}",
            "src/server/**/*.{test,spec}.{ts,tsx}",
            "src/app/api/**/*.{test,spec}.{ts,tsx}",
            "tests/**/*.{test,spec}.{ts,tsx}",
          ],
          exclude: ["node_modules", ".next", "tests/e2e/**", "tests/smoke/**"],
        },
      },
      {
        // Component project: App-Router screens/components rendered in jsdom.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "ui",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "src/app/**/*.{test,spec}.{ts,tsx}",
            "src/components/**/*.{test,spec}.{ts,tsx}",
          ],
          exclude: [
            "node_modules",
            ".next",
            "src/app/api/**",
            "tests/e2e/**",
            "tests/smoke/**",
          ],
        },
      },
      {
        // Smoke project (S29): boots the built standalone server and probes
        // /api/health. Node env, single-threaded, and a long timeout because it
        // may run `next build` and spawn a real server. Kept in its own project
        // so `npx vitest run tests/smoke` targets it precisely.
        resolve: { alias },
        test: {
          name: "smoke",
          globals: true,
          environment: "node",
          include: ["tests/smoke/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["node_modules", ".next"],
          fileParallelism: false,
          testTimeout: 240_000,
          hookTimeout: 240_000,
        },
      },
    ],
  },
});
