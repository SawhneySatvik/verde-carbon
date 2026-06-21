# ADR-002: Hexagonal adapter ports for Auth / Data / AI / Secrets (local-first, GCP by config swap)

- **Status:** accepted
- **Date:** 2026-06-20
- **Decider:** Architecture

## Context

The architecture requires that Auth (Firebase Anonymous-first), Data (Firestore), AI (Gemini), and Secrets
(Secret Manager) are reachable **only through adapter interfaces**, so `npm run dev` runs the full
core loop locally (emulator / in-memory mock + recorded AI fixtures, `.env.local`) with **zero GCP
calls**, and switching to GCP requires only config/env changes — **no source edits**. The risk
is GCP specifics leaking into core logic.

## Decision

Adopt a **hexagonal (ports-and-adapters)** boundary. Define four narrow TypeScript port interfaces
in `packages/core/ports` — `AuthPort`, `DataPort` (repository), `AiPort` (`GeminiClient`),
`SecretsPort` — that the domain/core depends on. Provide two adapter implementations per port:
a **local** one (in-memory or Firestore emulator for Data, anonymous mock for Auth, recorded-fixture
player for AI, `.env.local`/process-env for Secrets) and a **GCP** one (Firebase Auth, Firestore,
Gemini API, Secret Manager). A single **composition root** (`src/server/container.ts`) reads
`APP_ENV` and wires the chosen adapter set. Core code imports ports, never adapters or any
`firebase-*`/`@google-cloud/*` package.

## Alternatives considered

| Alternative                                  | Pros                                                                           | Cons                                                | Why rejected                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| Call Firebase/Gemini SDKs directly in routes | Less code                                                                      | GCP leaks everywhere; can't run locally; untestable | Breaks the local-first requirement outright              |
| Env flags scattered at call sites            | Quick                                                                          | `if (local)` littered through core; drift; leaks    | Not auditable; violates the leak-prevention goal         |
| Hexagonal ports + composition root (chosen)  | Core is I/O-free and unit-testable; provable "zero GCP" local run; swap by env | Up-front interface design; two impls per port       | This is exactly what the local-first requirement demands |

## Consequences

- **Positive:** A CI check runs the core loop with local adapters and no GCP credentials; the pure
  calculator/domain has zero I/O imports; provider swap is one env var; AI is testable via recorded
  fixtures with no network.
- **Negative:** Every capability needs a port + two adapters; some Firestore-specific query power is
  abstracted behind the repository (mitigated by keeping `DataPort` query methods task-shaped).
- **Reversibility:** Easy — adapters are additive; a third provider is a new adapter set.

## Validation

`APP_ENV=local npm run dev` and the e2e suite pass with **no** GCP credentials and no network to
Google; a lint/import rule (or test) fails if `packages/core/**` imports any `firebase`/
`@google-cloud` module.
