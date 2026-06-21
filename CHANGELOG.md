# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-20

Initial release: the full anonymous carbon-footprint core loop, runnable locally with zero GCP credentials and portable to Cloud Run by config swap.

### Added

- **Gemini grounding boundary** — AI parses natural language into a strict schema with no numeric emission field; a pure, unit-tested calculator (`packages/core/calculator`) is the sole producer of CO2e. Exact-value oracle pins gasoline (8.78 kg/gal) and air travel (0.207/0.129/0.163 kg/passenger-mile); a derived oracle pins US grid electricity (≈ 0.373 kg/kWh from 823.1 lb/MWh).
- **Seeded factor tables** — versioned EPA (US) and DEFRA/DESNZ (UK) emission factors with recorded source, native value/unit, and derivation; click-through-traceable provenance.
- **Round-trip-safe unit conversions** — metric ↔ imperial, tested lossless before any multiply.
- **Anonymous baseline onboarding** — 4-step wizard producing a sourced baseline footprint with in-place unit conversion and no redundant re-entry.
- **Natural-language activity logging** — parse → editable confirmation → calculator-computed CO2e + factor source shown _before save_; an AI-free structured fallback feeds the same calculator so the loop never blocks.
- **Dashboard** — total, trend, category breakdown, goal progress, and streak, with charts encoded beyond color and a data-table fallback.
- **Ranked personalized insights** — reductions derived from the user's own logs, with calculator-sourced projected savings.
- **Goals and streaks** — reduction targets and consecutive-day streaks with an explicit user-locale day-boundary rule.
- **Anonymous → sign-in account linking** — Firebase anonymous-first auth with `linkWithCredential`; idempotent atomic merge carries baseline and logs over with no data loss.
- **Hexagonal ports & adapters** — Auth/Data/AI/Secrets ports with local (mock auth, in-memory data, recorded-AI fixtures, env secrets) and GCP (Firebase Auth, Firestore, Gemini, Secret Manager) adapter sets, selected by an `APP_ENV` composition root.
- **Security hardening** — per-route authorization, Zod validation of all inputs and all AI output, in-memory rate limiter plus a persisted per-anon-uid daily AI quota and request-size cap, free-text sanitization on store, secrets only via the Secrets port, and Firestore rules enforcing `request.auth.uid == uid`.
- **Accessibility** — WCAG 2.2 AA across the core loop, verified by `@axe-core/playwright` on every screen plus explicit chart non-color tests.
- **Infrastructure** — `next.config.ts` standalone output, a multi-stage root `Dockerfile`, and `infra/cloudrun.yaml` (min-instances ≥ 1) as deploy artifacts.
- **CI** — lint + typecheck, Vitest unit/integration with coverage, emulator-backed Firestore rules, standalone health smoke, Playwright e2e + axe, an enforced 180 KB/route bundle-size gate, and a no-deploy Docker build.

### Fixed

- **Color-contrast a11y regression on 8 screens.** The Framer Motion entrance reveals mount at `opacity: 0` and fade to `1`; Framer keeps that opacity crossfade even under `prefers-reduced-motion`, so content painted through a still-faded reveal container dropped below its measured AA contrast (WCAG 1.4.3) — exactly the frame the axe gate caught. Fixed centrally in `globals.css` with a reduced-motion `[style*="opacity"] { opacity: 1 !important }` guard (scoped precisely to Framer's inline-style reveals; all decorative dimming uses Tailwind `opacity-*` classes / SVG attributes), plus `MotionProvider` collapsing transitions to `{ duration: 0 }` under reduced motion. Also deepened the light-theme on-tint text tokens one step for AA margin (`--brand-fg`/`--success-fg` `#15643F→#13593C`, `--info-fg` `#1C5A8A→#1A567F`). axe is back to **0 serious/critical** on every screen.

[0.1.0]: https://example.com/verde/releases/tag/v0.1.0
