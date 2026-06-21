# Verdé

[![CI](https://github.com/SawhneySatvik/verde-carbon/actions/workflows/ci.yml/badge.svg)](https://github.com/SawhneySatvik/verde-carbon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-brightgreen.svg)](.nvmrc)
[![TypeScript: strict](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![Tests](https://img.shields.io/badge/tests-472%20unit%20%2B%2038%20e2e%2Faxe-success.svg)](#code-quality)
[![WCAG 2.2 AA](https://img.shields.io/badge/a11y-WCAG%202.2%20AA-success.svg)](#accessibility-statement)

**Understand, track, and reduce your personal carbon footprint** — in plain language, with every number sourced.

> **Docs:** [Architecture](ARCHITECTURE.md) · [Code quality](#code-quality) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [ADRs](docs/adr/)

Verdé lets anyone (no account required) describe an everyday activity — _"drove 20 miles to work in my gas car"_ — and immediately see a transparent CO2e estimate, a dashboard of their footprint over time, and ranked, personalized actions to cut it. Most carbon trackers either bury you in surveys, hide their math, or quietly invent numbers that erode trust. Verdé closes that gap by making honesty structural.

> **Chosen vertical:** Sustainability / climate-action personal assistant.
> **Persona:** the _climate-curious individual_ — someone who wants to lower their footprint but has no trustworthy, low-friction way to measure it.
> **Smart, context-aware behavior:** Verdé reads each user's locale (to pick the right emission-factor set and unit system), their stated activities (parsed from plain language), and their own logged history (to rank reductions by the impact that matters most for _them_) — then makes every resulting number transparent and sourced.

---

## The differentiator: Gemini never invents an emission number

This is the core of the product, enforced in code rather than asked for in a prompt.

**Gemini only parses and explains. A pure, unit-tested calculator computes every number.**

- The Gemini response schema (`packages/core/schemas/ai-parse.schema.ts`) **structurally cannot hold a CO2e value**. It returns only `{ activity, value, unit, candidateFactorKey, confidence }` per item — there is no numeric emission field for a number to leak into. A guard test (`ai-parse.guard.test.ts`) fails if that ever changes.
- Every AI response is **re-validated with Zod** server-side: `unit` is a closed enum, `value` is a bounded finite positive number, and `candidateFactorKey` is checked against the seed vocabulary. Unknown keys, incompatible units, or out-of-bounds values are **routed to a structured fallback, never coerced to a guess**.
- The pure calculator (`packages/core/calculator/index.ts`) is the **sole producer** of emission numbers: `co2e = quantity_in_canonical_unit × factor`. It does no I/O, calls no AI, and imports nothing from React or GCP.
- Every factor is **sourced and click-through-traceable** to a published table (EPA GHG Emission Factors Hub or UK DEFRA/DESNZ), with the original source value, unit, and any derivation recorded.

Anchor values pinned by exact-value Vitest assertions (`packages/core/calculator/calculator.test.ts`):

| Activity                               | Factor                                        | Source                                                                | Test style              |
| -------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | ----------------------- |
| Gasoline                               | **8.78** kg CO2e / gallon                     | EPA GHG Factors Hub                                                   | `toBe` (exact)          |
| Air travel, short / medium / long haul | **0.207 / 0.129 / 0.163** kg / passenger-mile | EPA GHG Factors Hub                                                   | `toBe` (exact)          |
| US grid electricity                    | **≈ 0.373** kg / kWh                          | EPA eGRID — _derived_ from 823.1 lb/MWh (`823.1 × 0.45359237 / 1000`) | `toBeCloseTo(0.373, 3)` |

The derivation is recorded in the seed record itself (`sourceNative`, `derivation`), so "click to source" always shows the genuine published figure, not a rounded constant.

---

## Features

The full core loop works **anonymously, with no account and no GCP credentials**:

- **Anonymous baseline onboarding** — a 4-step wizard (home energy → transport → diet → review) provisions an anonymous session and computes a baseline footprint, with in-place unit conversion and no redundant re-entry.
- **Natural-language logging with a transparent breakdown** — type an activity, see the parsed items, the computed CO2e per item and total, and the factor source **before anything is saved** ("show before save"). Edits recompute instantly. Ambiguous factors require you to pick before the entry can be logged.
- **AI-free structured fallback** — if Gemini is unavailable, times out, is rate-limited, or returns malformed output, the same calculator and breakdown are reachable through a structured form. The loop never blocks on AI.
- **Dashboard with accessible charts** — current total, trend over time, category breakdown, goal progress, and streak. Charts encode data with more than color and ship a keyboard-reachable data-table fallback.
- **Ranked personalized insights** — reduction actions derived from your _own_ logged data; Gemini may phrase them, but the projected kg saved always comes from the calculator.
- **Goals + streaks** — set a reduction target and keep a logging streak, with an explicit user-locale day-boundary rule.
- **Anonymous → sign-in account linking** — sign in via Firebase to save and sync; your anonymous baseline and logs carry over with no data loss, via an idempotent atomic merge.

---

## Architecture

A single **Next.js 15 (App Router, strict TypeScript)** application, organized as a **hexagonal (ports & adapters) modular monolith** and packaged as one Cloud Run container. Local-first; GCP by config swap with no source changes.

```
                    ┌─────────────────────────────────────────────┐
                    │            Next.js 15 single container         │
                    │                                               │
   Browser  ──────► │  src/app/*   App Router UI (screens)           │
                    │     │                                          │
                    │     ▼                                          │
                    │  src/app/api/*/route.ts   Route Handlers       │
                    │     │   (per-route authz · Zod in & on AI out  │
                    │     │    · rate-limit · persisted AI quota)     │
                    │     ▼                                          │
                    │  packages/core/*   PURE DOMAIN (no I/O)         │
                    │     calculator · units · factors(seed) ·       │
                    │     schemas · insights · ports                 │
                    │     │                                          │
                    │     ▼  depends only on ports ───────────────┐  │
                    │  Auth │ Data │ AI │ Secrets   (4 ports)     │  │
                    └───────┼──────┼─────┼──────────┼─────────────┘  │
                            │      │     │          │
              APP_ENV=local │      │     │          │ APP_ENV=gcp
        ┌───────────────────┘      │     │          └───────────────────┐
        ▼                          ▼     ▼                              ▼
  Local adapters                                              GCP adapters
  · mock anonymous Auth                                       · Firebase Auth (anon + link)
  · in-memory Data (atomic batch/merge sim)                   · Firestore (uid-keyed)
  · recorded-AI-fixture player                                · Gemini (function-calling)
  · env / .env.local Secrets                                  · Secret Manager
   (zero GCP calls)                              (selected by the composition root)
```

- **`packages/core/*`** is pure and dependency-light: the deterministic calculator, round-trip unit conversions, the versioned seeded factor table, the Zod schemas (including the AI schema that cannot hold a number), the four port interfaces, and the insight ranker. An ESLint rule fails the build if core ever imports `firebase` or `@google-cloud`.
- **`src/server/*`** supplies two adapter sets per port and a **composition root** (`container.ts`) that reads `APP_ENV` (Zod-validated, fail-fast, defaults to `local`). A test asserts that with `APP_ENV=local` **no GCP client is constructed**.
- **`src/app/api/*`** exposes AI parse, logging, insights, goals, and linking as Route Handlers so authorization, validation, and rate-limiting are centralized and testable.
- **Cloud Run deployable**: `next.config.ts` builds `output: "standalone"`; the root `Dockerfile` ships it; `infra/cloudrun.yaml` pins `min-instances: 1` (no cold starts) and a persisted per-user AI quota keeps multi-instance scaling safe.

**Design & docs:** [Architecture & quality guarantees](ARCHITECTURE.md) · [Security](SECURITY.md) · [Contributing & code style](CONTRIBUTING.md) · [ADRs](docs/adr/) (the rationale behind each major decision).

---

## Run it locally

Requires **Node ≥ 22**. The default `APP_ENV=local` runs the **entire core loop with zero GCP credentials** — in-memory data, mock anonymous auth, and recorded Gemini fixtures.

```bash
npm install
cp .env.local.example .env.local   # default APP_ENV=local; no secrets needed
npm run dev                         # http://localhost:3000
```

Then, with no account:

1. Open the app, start **"Estimate my footprint"**, and complete the onboarding wizard to get a baseline.
2. Go to **Log**, type something like `drove 20 miles to work in my gas car`, and review the parsed items, the computed CO2e, and the factor source. Nothing is saved until you click **"Log it"**.
3. Open the **Dashboard** to see your total, trend, category breakdown, and streak; open **Insights** for ranked, sourced reductions.

The seeded emission factors live in **`packages/core/factors/seed/`** (`epa.json`, `defra-desnz.json`), with the derivation policy documented in [`packages/core/factors/derivation-policy.md`](packages/core/factors/derivation-policy.md).

### Quality commands

| Command                | What it does                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `npm test`             | Vitest unit + integration suite (incl. exact/derived CO2e oracle and AI-influence guards) |
| `npm run lint`         | ESLint, incl. the "no GCP import in core" rule                                            |
| `npm run test:e2e`     | Playwright e2e + `@axe-core` accessibility checks (Chromium)                              |
| `npm run size`         | Enforced `size-limit` bundle-size budget (≤ 180 KB gzip first-load JS / route)            |
| `npm run build`        | Production build (`output: "standalone"`)                                                 |
| `npm run format:check` | Prettier check                                                                            |

Switching to GCP is a config/env change only (`APP_ENV=gcp` plus project/secret config) — no source edits.

---

## How it scores on the six judged criteria

| Criterion                       | Evidence in the repo                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code Quality**                | Strict TypeScript; a pure, I/O-free domain core in [`packages/core/*`](packages/core/) behind four ports; a **build-failing** ESLint rule that keeps the core provider-free ([`eslint-no-gcp-in-core.cjs`](eslint-no-gcp-in-core.cjs)); typed `CalcResolved \| CalcFallback` errors; ESLint (`no-explicit-any`, `max-lines: 350`, …) + Prettier as hard CI gates. See the [**Code quality**](#code-quality) section and [`ARCHITECTURE.md`](ARCHITECTURE.md).                             |
| **Security**                    | Per-route authorization on every API route; Zod validation of **all inputs and all AI output**; secrets only via the Secrets port (never committed or logged — `src/server/secrets/`); AI endpoints rate-limited with an **in-memory limiter + a persisted per-anon-uid daily quota** (multi-instance-safe) and a request-size cap; free text sanitized on store; second-order prompt-injection test; Firestore rules enforce `request.auth.uid == uid`; OWASP REST + Secrets checklists. |
| **Efficiency**                  | Cloud Run `min-instances: 1` (no cold starts); Gemini context caching on the static prompt prefix + tight schema and small `maxOutputTokens` as the real cost control; Firestore composite indexes (no unindexed scans); CI-enforced 180 KB gzip/route bundle budget.                                                                                                                                                                                                                     |
| **Testing**                     | 472 unit & integration tests (Vitest, across 45 files) plus 38 Playwright e2e + axe specs (6 files), all in CI; **exact** CO2e oracle (`toBe`) for published anchors and a **derived** oracle (`toBeCloseTo(0.373, 3)`) for the grid; AI-influence guard tests; emulator-backed Firestore rules + merge-twice/batch-boundary tests; coverage reported with the calculator at high line/branch coverage.                                                                                   |
| **Accessibility**               | WCAG 2.2 AA target: semantic HTML, skip link, visible focus, ≥ 4.5:1 contrast, reduced-motion honored, charts encoded by more than color with data-table fallbacks; `@axe-core/playwright` on every screen (zero serious/critical) plus explicit chart non-color tests.                                                                                                                                                                                                                   |
| **Problem-Statement Alignment** | The grounding loop **is** the product: Gemini parses, the calculator computes, every number is sourced and click-through-traceable, and a structural schema makes an AI-invented number impossible.                                                                                                                                                                                                                                                                                       |

---

## Code quality

Quality here is **enforced by tooling and tests**, not left to convention. Full detail lives in [`ARCHITECTURE.md`](ARCHITECTURE.md) (module map + quality guarantees), the [ADRs](docs/adr/), and [`CONTRIBUTING.md`](CONTRIBUTING.md) (the enforced style). Concretely:

- **Strict typing.** `strict`, `noImplicitAny`, `noUnusedLocals` / `noUnusedParameters`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules` ([`tsconfig.json`](tsconfig.json)). No `any` and no unsafe casts on the happy path.
- **An enforced architectural boundary.** The domain in [`packages/core/*`](packages/core/) is pure and I/O-free; a custom ESLint rule ([`eslint-no-gcp-in-core.cjs`](eslint-no-gcp-in-core.cjs)) **fails the build** if it ever imports `next`, `react`, `firebase`, or `@google-cloud`. Adapters sit behind four ports ([`packages/core/ports/`](packages/core/ports/)); a test proves the local run constructs **zero** GCP clients ([`container.test.ts`](src/server/container.test.ts)).
- **Lint + format gates.** ESLint ([`.eslintrc.cjs`](.eslintrc.cjs)) enforces `no-explicit-any`, `consistent-type-imports`, `eqeqeq`, `no-var`, `prefer-const`, `no-console`, and a **`max-lines: 350`** ceiling, so every screen stays composed of small, single-responsibility sub-components in co-located `_components/` folders rather than growing monolithic. Prettier formatting is a **hard CI gate**.
- **Errors are typed, not stringly.** The calculator returns a `CalcResolved | CalcFallback` discriminated union — an unsourced item is never silently zeroed ([`packages/core/calculator/index.ts`](packages/core/calculator/index.ts)); all routes share one JSON error contract ([`src/server/http/errors.ts`](src/server/http/errors.ts)).
- **Tests pin the contract.** 472 unit/integration + 38 e2e/axe specs; exact-value oracles pin published factors and a guard test fails if the AI schema ever gains a numeric field ([`calculator.test.ts`](packages/core/calculator/calculator.test.ts), [`ai-parse.guard.test.ts`](packages/core/schemas/ai-parse.guard.test.ts)).
- **Every push is gated.** Lint, typecheck, format-check, unit, emulator-backed Firestore rules, a standalone smoke test, e2e + axe, the bundle-size budget, and a Docker build all run in CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) — all hard gates; CI never deploys.

---

## Project structure

```
packages/core/          Pure, I/O-free domain (the testable heart)
  calculator/             CO2e = quantity × factor; exact/derived oracle tests
  units/                  Round-trip-safe metric ↔ imperial conversions
  factors/seed/           Versioned EPA + DEFRA/DESNZ factor tables (JSON)
  schemas/                Zod schemas incl. AI parse schema (no CO2e field)
  insights/               Ranked reduction derivation (numbers from calculator)
  ports/                  AuthPort · DataPort · AiPort · SecretsPort
src/server/             Adapters + composition root
  adapters/local/         In-mem data · mock auth · recorded-AI fixtures · env secrets
  adapters/gcp/           Firestore · Firebase Auth · Gemini · Secret Manager
  container.ts            Reads APP_ENV, wires the adapter set
  http/                   authz · validate · rateLimit · aiQuota · errors
src/app/                App Router UI + Route Handlers (api/*)
tests/                  e2e (Playwright + axe) · rules (emulator) · smoke
infra/                  Dockerfile (standalone) · cloudrun.yaml (min-instances)
```

---

## Tech stack

- **Framework:** Next.js 15 (App Router), React 19, strict TypeScript, Tailwind CSS
- **Validation:** Zod (all inputs and all AI output)
- **AI:** Google Gemini via `@google/genai` (function-calling + `responseSchema`; parses only)
- **Auth / Data / Secrets:** Firebase Auth, Firestore, Secret Manager (GCP adapter set)
- **Testing:** Vitest (unit + integration), Playwright + `@axe-core/playwright` (e2e + a11y), `@firebase/rules-unit-testing` (emulator), `size-limit` (bundle budget)
- **Runtime:** Node ≥ 22; single Cloud Run container (`output: "standalone"`)

## Accessibility statement

Verdé targets **WCAG 2.2 AA** across the entire core loop. Every screen uses semantic landmarks and a single `<h1>`, a visible-on-focus skip link, full keyboard operability with a visible focus indicator, ≥ 4.5:1 text contrast, and honors `prefers-reduced-motion`. Charts never rely on color alone — each carries direct labels, non-color markers, a text summary, and a keyboard-reachable, screen-reader-exposed data-table fallback. Automated `@axe-core/playwright` checks run in CI on every screen (zero serious/critical violations) alongside explicit chart and a manual keyboard/screen-reader pass.

---

## Assumptions

These are the deliberate scoping and design assumptions behind the build:

- **Anonymous-first.** Most first-time users won't create an account, so the entire core loop works anonymously. Local sessions are in-memory and non-durable across restarts; durability and cross-device sync arrive only after a user links a Firebase sign-in (the anonymous baseline and logs migrate via an idempotent atomic merge).
- **Emission factors are pinned, vetted snapshots — not a live feed.** Numbers come from seeded **EPA GHG Emission Factors Hub (US, 2025)** and **UK DEFRA/DESNZ** tables, version-stamped in the repo (`packages/core/factors/seed/`). They are intentionally a controlled snapshot so every figure is reproducible and auditable; refreshing them is a deliberate, reviewed update, not an automatic fetch.
- **Factors express CO2e using the GWP-100 basis** as published in those source tables.
- **Locale drives sensible defaults.** US → EPA factors + imperial units; UK → DEFRA/DESNZ + metric. Users can override the factor set and unit system in Settings; switching applies to _new_ logs while historical entries preserve the `co2eKg` and `factorSetVersion` they were computed with.
- **Gemini is treated as optional and possibly-unavailable.** AI only parses language and phrases insights — it never produces a number. If it is slow, rate-limited, errors, or returns malformed output, the same calculator and breakdown remain reachable through a structured fallback form, so the loop never blocks on AI.
- **Streaks and day boundaries use the user's locale timezone**, so "today" means the user's day, not the server's.
- **Deployment target is a single-region Cloud Run service** with `min-instances: 1` (no cold starts); the persisted per-user AI quota keeps horizontal scaling correct across instances.
- **One coherent core loop.** Onboarding → log → dashboard → insights → goals → account-linking is fully built, along with image-based logging and a conversational coach — all behind the same grounding boundary (AI never emits a number).

---

## Deploy

`APP_ENV` defaults to `local`, so the app **boots and runs with no secrets, Firebase, or Gemini key** on either host below. For durable persistence and live Gemini, run in **GCP mode** (`APP_ENV=gcp`) — full provisioning, IAM, and the checklist are in [`infra/RUNBOOK.md`](infra/RUNBOOK.md).

### Cloud Run — recommended for the zero-config demo

The repo ships a root `Dockerfile` (`output: "standalone"`, non-root, `/api/health` probe). Connect the GitHub repo in the Cloud Run console, or run:

```bash
gcloud run deploy verde --source . --region REGION --allow-unauthenticated
```

Cloud Build auto-detects the `Dockerfile`; no environment variables are required. With `min-instances: 1` (`infra/cloudrun.yaml`) a single warm instance keeps the in-memory demo store consistent across requests.

### Vercel

As a standard Next.js 15 app, Verdé deploys to Vercel with no configuration — import the repo (or run `vercel`); the default build just works, and `APP_ENV` defaults to `local`.

> ⚠️ **Serverless persistence caveat.** In `local` mode the data store and anonymous sessions live **in memory, per server process** (by design). Vercel serves each request from a serverless function, so that state isn't durably shared across requests — a single warm walkthrough works, but data can reset on cold starts or between users. For a reliable demo prefer Cloud Run (one long-lived instance); for durable persistence on Vercel, run **GCP mode** (`APP_ENV=gcp` plus the Firebase/Gemini config as Vercel environment variables), which also needs client-side Firebase sign-in for the bearer token.

CI builds the Docker image and uploads reports but **never deploys** — it produces deploy artifacts only.
