const { noGcpInCoreOverride } = require("./eslint-no-gcp-in-core.cjs");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    "next-env.d.ts",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  overrides: [
    // packages/core stays framework- and provider-free (ADR-002, FR-11).
    noGcpInCoreOverride,
  ],
};
