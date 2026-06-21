# Contributing to Verdé

Thanks for your interest. This guide covers local setup, the enforced code style, and the checks every change must pass.

## Getting started

Requires **Node ≥ 22** (see [`.nvmrc`](.nvmrc) / `package.json` engines).

```bash
npm install
cp .env.local.example .env.local   # default APP_ENV=local — no secrets needed
npm run dev                         # http://localhost:3000
```

The default `APP_ENV=local` runs the **entire app with zero cloud credentials** — in-memory data, mock anonymous auth, and recorded Gemini fixtures. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the module layout and [`docs/adr/`](docs/adr/) for design rationale.

## Code style (enforced)

Style is enforced by tooling, not reviewer preference — run the checks locally before pushing.

- **Strict TypeScript** — `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `verbatimModuleSyntax` ([`tsconfig.json`](tsconfig.json)). No `any`.
- **ESLint** ([`.eslintrc.cjs`](.eslintrc.cjs)) — `no-explicit-any`, `consistent-type-imports`, `eqeqeq`, `no-var`, `prefer-const`, `no-console` (warn/error only), and **`max-lines: 350`** per source file. Plus the custom rule that forbids `next`/`react`/`firebase`/`@google-cloud` imports inside `packages/core/*`.
- **Prettier** — run `npm run format`; CI checks formatting as a hard gate.
- **Conventions** — pure domain in `packages/core/*` (depends only on ports); adapters in `src/server/adapters/{local,gcp}/*`; shared route guards in `src/server/http/*`; screens keep presentational pieces in a co-located `_components/` folder while state/refs/effects stay in the page.

## Testing

| Command                | What it runs                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `npm test`             | Vitest unit + integration (calculator oracle, AI-influence guards, adapters, route handlers) |
| `npm run test:e2e`     | Playwright e2e + `@axe-core/playwright` accessibility (Chromium)                             |
| `npm run lint`         | ESLint (incl. the no-GCP-in-core rule)                                                       |
| `npm run format:check` | Prettier check                                                                               |
| `npm run size`         | `size-limit` bundle budget (≤ 180 KB gzip first-load JS / route)                             |
| `npm run build`        | Production build (`output: "standalone"`)                                                    |

New behavior needs a test. UI changes must keep the axe checks green (WCAG 2.2 AA) and preserve the roles/labels existing tests rely on.

## CI gates

Every push runs (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)): lint + typecheck, format-check, unit/integration with coverage, emulator-backed Firestore-rules tests, a standalone-server smoke test, Playwright e2e + axe, the bundle-size budget, and a Docker image build. All are hard gates; CI never deploys.

## Design decisions

Significant decisions are recorded as ADRs in [`docs/adr/`](docs/adr/). If you change a load-bearing decision (the grounding boundary, the ports layout, the factor model), add or update an ADR.
