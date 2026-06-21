# Architecture Decision Records

Each ADR captures one significant technical decision — its context, the decision, the
alternatives considered, and the consequences. They are the durable rationale behind Verdé's
architecture (see the [project README](../../README.md) for the overview).

| ADR | Decision |
| --- | --- |
| [ADR-001](ADR-001-gemini-grounding-boundary.md) | Gemini grounding — AI parses, the pure calculator computes (no AI-emitted numbers) |
| [ADR-002](ADR-002-adapter-ports-local-first.md) | Hexagonal adapter ports for Auth / Data / AI / Secrets (local-first, GCP by config swap) |
| [ADR-003](ADR-003-emission-factor-model-seed.md) | Emission-factor data model & seed format (EPA + DEFRA/DESNZ, metric + imperial, locale default) |
| [ADR-004](ADR-004-firestore-document-model-anon.md) | Firestore document model & anonymous-uid → sign-in account linking |
| [ADR-005](ADR-005-nextjs-structure-cloudrun.md) | Next.js 15 App Router structure, route handlers vs server actions, Cloud Run packaging |
| [ADR-006](ADR-006-testing-strategy.md) | Testing strategy — Vitest exact-value + integration, Playwright e2e, axe |
