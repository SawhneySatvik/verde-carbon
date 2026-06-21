# ADR-005: Next.js 15 App Router structure, route handlers vs server actions, and Cloud Run packaging

- **Status:** accepted
- **Date:** 2026-06-20
- **Decider:** Architecture

## Context

The app is Next.js 15 (App Router) + strict TypeScript, deployed as a **single container to Cloud
Run** (efficiency NFR: min-instances, small bundle). We must decide how mutations/AI calls are
exposed (Route Handlers vs Server Actions), where the pure core lives so it stays I/O-free and
highly testable, and how the container is built. Security NFR requires per-route authz + Zod on
every input including AI output, and AI endpoints must be rate-limited and prompt-injection-hardened.

## Decision

Use a **modular monorepo-style layout inside one Next.js app**: `packages/core/*` holds the pure,
dependency-light domain (calculator, units, factors, ports, schemas) with **no React and no GCP
imports**; `src/server/*` holds adapters + the composition root; `src/app/*` is the App Router UI.
Expose the **AI parse, logging, insights, goals, and linking operations as Route Handlers**
(`src/app/api/*/route.ts`) — not Server Actions — because they need explicit per-route
authorization, Zod request/response validation, rate limiting, and uniform error contracts that are
easiest to centralize and test on Route Handlers. Server Actions are reserved for trivial, same-auth
form posts where the ceremony of a handler adds nothing. **Package as a single multi-stage
Dockerfile** producing Next.js `output: "standalone"`, run on Cloud Run with **min-instances ≥ 1**
to avoid cold starts and **Gemini context caching** to bound AI cost/latency.

## Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Server Actions for everything | Less boilerplate; co-located | Harder to apply uniform authz/rate-limit/Zod-on-response + test in isolation; AI endpoints need explicit shape | Security/AI surfaces need handler-level control |
| Route Handlers for everything incl. trivial posts | Uniform | Boilerplate where not needed | Use actions for trivial same-auth posts only |
| Route Handlers for AI/mutations + actions for trivial posts (chosen) | Centralized authz/Zod/rate-limit; testable; small surface | Two patterns to know | Best fit for the security + efficiency NFRs |

## Consequences

- **Positive:** Core is framework-agnostic and trivially unit-tested; every sensitive operation has a
  single, testable handler where authz + Zod + rate-limiting live; `standalone` output keeps the
  image and bundle small; min-instances + context caching meet the efficiency targets.
- **Negative:** Two invocation patterns in the codebase; a discipline rule ("AI/mutations = handler")
  must be documented and enforced in review.
- **Reversibility:** Moderate — moving an action to a handler (or back) is local.

## Validation

Bundle-size budget enforced in CI; a smoke test that every `api/*` handler rejects unauthorized/
invalid input and that AI handlers reject over-rate requests; the container builds and serves the
health check; Cloud Run config declares min-instances and context caching is exercised in the AI
adapter.
