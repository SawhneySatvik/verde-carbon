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
    // No untyped escapes — the calculator/grounding contract relies on real types.
    "@typescript-eslint/no-explicit-any": "error",
    // Keep type-only imports explicit (pairs with verbatimModuleSyntax).
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports" },
    ],
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-var": "error",
    "prefer-const": "error",
    // Allow diagnostic error/warn (e.g. the route error boundary); flag stray logs.
    "no-console": ["warn", { allow: ["warn", "error"] }],
    // Structural ceiling: no source file exceeds 350 code lines (keeps screens
    // composed from focused sub-components rather than growing monolithic).
    "max-lines": [
      "error",
      { max: 350, skipBlankLines: true, skipComments: true },
    ],
  },
  overrides: [
    // packages/core stays framework- and provider-free (ADR-002).
    noGcpInCoreOverride,
    {
      // Tests and seed data are allowed to be long (exhaustive cases / fixtures).
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      rules: { "max-lines": "off" },
    },
  ],
};
