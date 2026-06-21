# Architecture

Verdé is a single **Next.js 15 (App Router, strict TypeScript)** application organized as a **hexagonal (ports & adapters) modular monolith** and packaged as one container. It runs **local-first** — the entire product works with zero cloud credentials — and switches to GCP (Firestore, Firebase Auth, Gemini, Secret Manager) by an environment variable, with no source changes.

## The boundary

```
                    ┌─────────────────────────────────────────────┐
                    │            Next.js 15 single container         │
   Browser  ──────► │  src/app/*            App Router UI (screens)  │
                    │     ▼                                          │
                    │  src/app/api/*/route.ts   Route Handlers       │
                    │     │   per-route authz · Zod in & on AI out   │
                    │     │   · rate-limit · persisted AI quota       │
                    │     ▼                                          │
                    │  packages/core/*      PURE DOMAIN (no I/O)      │
                    │     calculator · units · factors · schemas ·   │
                    │     insights · ports                           │
                    │     ▼  depends only on ports ───────────────┐  │
                    │  Auth │ Data │ AI │ Secrets   (4 ports)     │  │
                    └───────┼──────┼─────┼──────────┼─────────────┘  │
          APP_ENV=local ────┘      │     │          └──── APP_ENV=gcp
        ▼                          ▼     ▼                          ▼
  Local adapters                                          GCP adapters
  · mock anonymous Auth                                   · Firebase Auth
  · in-memory Data                                        · Firestore (uid-keyed)
  · recorded-AI-fixture player                            · Gemini (function-calling)
  · env / .env.local Secrets                              · Secret Manager
```

The composition root [`src/server/container.ts`](src/server/container.ts) reads a Zod-validated `APP_ENV` ([`src/server/env.ts`](src/server/env.ts)) and wires one adapter set. GCP adapter modules are **lazily imported**, so a local run never even loads `firebase` / `@google-cloud` / `@google/genai`. A test asserts that under `APP_ENV=local` **no GCP client is constructed** ([`src/server/container.test.ts`](src/server/container.test.ts)).

## Module map

| Path                                                       | Responsibility                                                                                                                                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/core/calculator/`](packages/core/calculator/)   | The **sole producer** of CO₂e: `co2e = quantity_in_canonical_unit × factor`. Pure, no I/O. Returns a `CalcResolved \| CalcFallback` discriminated union — unsourced items are never silently zeroed. |
| [`packages/core/units/`](packages/core/units/)             | Round-trip-safe metric ↔ imperial conversions, tested lossless before any multiply.                                                                                                                  |
| [`packages/core/factors/`](packages/core/factors/)         | Versioned, seeded EPA + UK DEFRA/DESNZ factor tables with recorded source/derivation; the lookup repository and its vocabulary.                                                                      |
| [`packages/core/schemas/`](packages/core/schemas/)         | Zod schemas for the domain **and** the AI parse — the AI schema has no field that can hold a CO₂e number.                                                                                            |
| [`packages/core/insights/`](packages/core/insights/)       | Ranks reduction candidates by calculator-computed kg-saved; unresolved legs are skipped with a reason, never guessed.                                                                                |
| [`packages/core/ports/`](packages/core/ports/)             | The four interfaces — `AuthPort`, `DataPort`, `AiPort`, `SecretsPort`. Core depends only on these.                                                                                                   |
| [`src/server/adapters/local/`](src/server/adapters/local/) | Zero-GCP implementations: mock anonymous auth, in-memory data, recorded-AI fixtures, env secrets.                                                                                                    |
| [`src/server/adapters/gcp/`](src/server/adapters/gcp/)     | Firebase Auth, Firestore, Gemini, Secret Manager implementations (lazy-loaded).                                                                                                                      |
| [`src/server/http/`](src/server/http/)                     | Shared Route-Handler guards: authz, Zod validation (input + AI output), token-bucket rate limiter, persisted AI quota, uniform JSON error contract, request-size caps.                               |
| [`src/app/api/*/route.ts`](src/app/api/)                   | Thin Route Handlers that compose the guards and call ports through the container.                                                                                                                    |
| [`src/app/*`](src/app/)                                    | App Router screens. Each route group keeps presentational sub-components in a co-located `_components/` folder; data-fetching, state, refs, and focus management stay in the page.                   |

## Quality guarantees (enforced, not aspirational)

These are guaranteed by code/tests/build gates, not by convention:

- **The core stays pure.** A custom ESLint rule ([`eslint-no-gcp-in-core.cjs`](eslint-no-gcp-in-core.cjs)) **fails the build** if anything in `packages/core/*` imports `next`, `react`, `firebase`, or `@google-cloud`. The domain is provably framework- and provider-free (see [`docs/adr/ADR-002`](docs/adr/ADR-002-adapter-ports-local-first.md)).
- **Gemini cannot emit a number.** The AI parse schema structurally has no numeric emission field; a guard test ([`packages/core/schemas/ai-parse.guard.test.ts`](packages/core/schemas/ai-parse.guard.test.ts)) fails if one is ever added. Every CO₂e is produced by the pure calculator (see [`docs/adr/ADR-001`](docs/adr/ADR-001-gemini-grounding-boundary.md)).
- **Published factors are pinned.** Exact-value oracle tests pin anchors to their published sources — gasoline `8.78 kg/gal`, air travel `0.207/0.129/0.163 kg/passenger-mile` (`toBe`), US grid `≈0.373 kg/kWh` derived from `823.1 lb/MWh` (`toBeCloseTo`) — in [`packages/core/calculator/calculator.test.ts`](packages/core/calculator/calculator.test.ts).
- **All input and all AI output is Zod-validated** at the server seam ([`src/server/http/validate.ts`](src/server/http/validate.ts)); unknown keys / incompatible units / out-of-bounds values route to a structured fallback, never a guess.
- **Type safety is strict.** `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules` ([`tsconfig.json`](tsconfig.json)); no `any` or unsafe casts on the happy path.
- **Files stay focused.** An ESLint `max-lines: 350` ceiling ([`.eslintrc.cjs`](.eslintrc.cjs)) keeps screens composed of small, single-responsibility sub-components rather than growing monolithic.

For the rationale behind each major decision, see the [ADRs](docs/adr/). For the security posture, see [`SECURITY.md`](SECURITY.md). For local setup and the enforced style, see [`CONTRIBUTING.md`](CONTRIBUTING.md).
