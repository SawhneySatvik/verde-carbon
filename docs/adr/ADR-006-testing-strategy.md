# ADR-006: Testing strategy — Vitest exact-value + integration, Playwright e2e, axe

- **Status:** accepted
- **Date:** 2026-06-20
- **Decider:** Architecture

## Context

Testing is a judged NFR and is load-bearing for the product's core promise (determinism + sourcing).
We must prove: exact CO2e values, round-trip-safe unit conversions, the "AI never emits a number"
guarantee, the full anonymous core loop end-to-end (including anon→sign-in linking), and WCAG 2.2
AA. The local-first adapter design (ADR-002) means tests must run with **no GCP credentials**.

## Decision

Four layers:

1. **Vitest unit** — the pure core (`packages/core/*`): exact-value calculator tests (1 gal gasoline
   = 8.78 kg; air short/medium/long = 0.207/0.129/0.163 kg/passenger-mile; 1 kWh US grid ≈ 0.373
   kg), round-trip unit-conversion tests, and a **guard test** asserting the AI response schema
   cannot carry a CO2e field. High line/branch coverage required here.
2. **Vitest integration** — Route Handlers against **local adapters** (in-mem/emulator + recorded AI
   fixtures): authz rejection, Zod rejection of bad input _and_ bad AI output, rate-limit behavior,
   structured-fallback path when AI is unavailable.
3. **Playwright e2e** — the anonymous core loop: onboarding → NL log (show-before-save) →
   dashboard → insights → goal/streak → sign-in linking (no data loss), all against local adapters.
4. **axe** — automated accessibility checks wired into the e2e run on every screen
   (zero serious/critical), plus a documented manual keyboard + screen-reader pass before review.

All four run in CI with coverage reported and a bundle-size budget gate.

## Alternatives considered

| Alternative                                                  | Pros                                               | Cons                                       | Why rejected                                      |
| ------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Unit tests only                                              | Fast                                               | Doesn't prove the loop, authz, or a11y     | Testing NFR demands integration + e2e + a11y      |
| Mock GCP SDKs ad hoc per test                                | Flexible                                           | Drifts from the real adapter seam; brittle | The adapter ports already give a clean local seam |
| Layered Vitest + Playwright + axe on local adapters (chosen) | Proves determinism, security, loop, a11y; no creds | More CI time                               | Matches what is judged                            |

## Consequences

- **Positive:** The core promise is provable and regression-guarded; CI needs no secrets; a11y is a
  gate not an afterthought.
- **Negative:** Recorded AI fixtures must be maintained; e2e is slower than unit.
- **Reversibility:** Easy — layers are additive.

## Validation

CI is green only when unit (incl. exact-value + AI-schema guard) + integration + Playwright e2e +
axe all pass, coverage is reported with the calculator at high line/branch coverage, and the
bundle-size budget holds.
