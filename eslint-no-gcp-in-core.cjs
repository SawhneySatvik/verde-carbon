/**
 * Import-guard (ADR-002, FR-11): `packages/core/**` must stay framework- and
 * provider-free. It may import the ports it depends on, never next/react or any
 * firebase / @google-cloud / @google/genai module. A violation fails `npm run
 * lint` (and therefore the S30 CI gate). Exported as an ESLint `overrides`
 * entry and consumed by `.eslintrc.cjs`.
 */
const PROVIDER_AND_FRAMEWORK_IMPORTS = [
  "next",
  "next/*",
  "react",
  "react-dom",
  "react/*",
  "firebase",
  "firebase/*",
  "firebase-admin",
  "firebase-admin/*",
  "@google-cloud/*",
  "@google/genai",
];

/** @type {import("eslint").Linter.ConfigOverride} */
const noGcpInCoreOverride = {
  files: ["packages/core/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: PROVIDER_AND_FRAMEWORK_IMPORTS,
            message:
              "packages/core must stay framework- and provider-free (ADR-002, FR-11): import ports, not next/react/firebase/@google-cloud/@google-genai.",
          },
        ],
      },
    ],
  },
};

module.exports = { noGcpInCoreOverride, PROVIDER_AND_FRAMEWORK_IMPORTS };
