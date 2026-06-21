# ADR-003: Emission-factor data model & seed format (EPA + DEFRA/DESNZ, metric+imperial, locale default)

- **Status:** accepted
- **Date:** 2026-06-20
- **Decider:** Architecture

## Context

CO2e must be computed against a **vetted, sourced, versioned** factor table covering EPA (US) and
DEFRA/DESNZ (UK), supporting metric + imperial units, defaulting by locale with user override.
Every rendered number must link back to its source factor and the arithmetic. The table must be
extensible to more regions without changing calculator code.
Known anchor values the calculator must reproduce exactly: gasoline 8.78 kg/gal; air travel
short/medium/long 0.207/0.129/0.163 kg per passenger-mile; US grid ≈ 0.373 kg/kWh.

## Decision

Seed factors as a **typed, versioned JSON dataset** (`packages/core/factors/seed/*.json`) loaded by
a `FactorRepository`, with each record:

```
{
  key: "transport.car.gasoline",      // controlled vocabulary; AI maps NL -> this key
  factorSet: "EPA" | "DEFRA_DESNZ",
  category: "transport" | "energy" | "diet" | ...,
  value: 8.78,                        // kg CO2e per canonical unit
  canonicalUnit: "gallon",            // factor's native unit
  unitSystem: "imperial" | "metric",
  source: { name: "EPA GHG Factors Hub", url, edition, publishedYear },
  notes?, gwpBasis?
}
```

Quantities are converted to the factor's `canonicalUnit` by a pure, round-trip-safe `units` module
(exact rational conversions where possible) before multiplying. **Locale default**: a small
`locale -> { factorSet, unitSystem }` map (UK → DEFRA_DESNZ + metric; US → EPA + imperial) sets
defaults; the user can override factor set and units independently in Settings. A `factorSetVersion`
field stamps each computed result so provenance is reproducible.

## Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Hard-code factors in calculator code | Fast | Not sourced/versioned; can't extend without code edits | Breaks sourcing + extensibility |
| Store factors only in Firestore | Central | Couples the pure calculator to I/O; can't run/test offline | Calculator must stay pure/offline-testable |
| Typed versioned seed JSON + FactorRepository (chosen) | Sourced, versioned, offline, extensible, testable | Must maintain the key vocabulary + conversions | Meets all of the sourcing + extensibility goals |

## Consequences

- **Positive:** Exact-value tests assert anchors (8.78, 0.207/0.129/0.163, 0.373); the breakdown UI
  reads source + arithmetic straight off the record; adding EU/IPCC later is a new seed file + keys,
  no calculator change; unit conversions are independently unit-tested and round-trip-safe.
- **Negative:** A controlled `key` vocabulary must be kept in sync with what the AI can map onto;
  imperial↔metric conversions need careful exact handling to keep round-trips lossless.
- **Reversibility:** Easy — seed is data; schema is versioned.

## Validation

Vitest asserts the anchor values exactly and asserts round-trip unit conversions are lossless; every
UI number resolves to a `{ source, value, canonicalUnit, arithmetic }` it was derived from.
