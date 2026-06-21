# Documentation

| Doc                                        | What it covers                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| [`../README.md`](../README.md)             | Project overview, the grounding differentiator, features, how to run, and how it maps to the judged criteria |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | The hexagonal ports/adapters boundary, the module map, and the enforced quality guarantees                   |
| [`../SECURITY.md`](../SECURITY.md)         | Authentication, input + AI-output validation, abuse/cost controls, secrets, data handling                    |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Local setup, the enforced code style, the test suite, and the CI gates                                       |
| [`adr/`](adr/)                             | Architecture Decision Records — the rationale behind each major technical decision                           |

## Architecture Decision Records

See [`adr/README.md`](adr/README.md) for the full index. In brief:

- **ADR-001** — Gemini grounding: AI parses, the pure calculator computes (no AI-emitted numbers)
- **ADR-002** — Hexagonal adapter ports (local-first, GCP by config swap)
- **ADR-003** — Emission-factor data model & seed format (EPA + DEFRA/DESNZ)
- **ADR-004** — Firestore document model & anonymous → sign-in linking
- **ADR-005** — Next.js structure, route handlers, and Cloud Run packaging
- **ADR-006** — Testing strategy (exact-value oracles, e2e, axe)
