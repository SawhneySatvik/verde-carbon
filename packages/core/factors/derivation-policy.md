# Factor seed — source, precision & derivation policy

> Owner: `packages/core/factors`. Enforced by `seed.schema.test.ts`. This is the contract that
> keeps the judged promise **"every number is exact and sourced"** truthful, including the
> "click to source" affordance.

## Why this exists

Some published emission factors are quoted directly in the unit we compute in (e.g. EPA gasoline
**8.78 kg CO2 / gallon**). Others are published in a _different_ native unit and must be **derived**
into our canonical unit (e.g. the US average grid is published as **823.1 lb CO2 / MWh**, but we
compute in **kg / kWh**). If we silently stored only the derived number, "click to source" would show
a figure that does not appear in the cited document. The policy below prevents that.

## Record fields

Each record in `seed/*.json` conforms to `factorRecordSchema`:

| Field              | Meaning                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `key`              | Controlled vocabulary key the AI maps NL onto (validated by the repository).                               |
| `value`            | kg CO2e per `canonicalUnit` — the number the calculator multiplies by.                                     |
| `canonicalUnit`    | The factor's native unit; quantities are converted to this before multiplying.                             |
| `source`           | `{ name, url, edition, publishedYear }` — what "click to source" links to.                                 |
| `sourceNative?`    | The figure **as published** when it differs from `value`'s unit (e.g. `{ value: 823.1, unit: "lb/MWh" }`). |
| `derivation?`      | The exact arithmetic that turns `sourceNative` into `value`.                                               |
| `assertionStyle`   | How the value is pinned by tests: `toBe` (exact) or `toBeCloseTo:<target>:<digits>` (derived).             |
| `factorSetVersion` | Provenance stamp copied onto every computed result.                                                        |

## The two assertion styles

### `toBe` — published-exact

The record's `value` is **the published number itself**, already in `canonicalUnit`. There is no
arithmetic between the document and our table, so the value is pinned with strict `toBe` equality and
the record carries **no** `derivation`. The test asserts a `toBe` record has no `derivation`.

Anchors with `toBe`:

- `transport.car.gasoline` — **8.78** kg / gallon (EPA GHG Emission Factors Hub).
- `transport.car.diesel` — **10.21** kg / gallon (EPA).
- `transport.air.short` — **0.207** kg / passenger-mile (EPA).
- `transport.air.medium` — **0.129** kg / passenger-mile (EPA).
- `transport.air.long` — **0.163** kg / passenger-mile (EPA).
- The DEFRA/DESNZ records (published directly in kg per km / passenger-km / kWh / meal).

### `toBeCloseTo:<target>:<digits>` — derived

The published figure is in a different unit, so `value` is the **result of a recorded conversion**.
The record MUST carry `sourceNative` (the genuine published figure + its unit) and `derivation`
(the exact arithmetic). "Click to source" shows the published `sourceNative` value; the calculator
uses the derived `value`. The test reproduces `value` from `sourceNative` + `derivation` and pins it
with `toBeCloseTo(target, digits)`.

The one derived anchor:

- `energy.electricity.grid` (EPA / eGRID): `sourceNative` = **823.1 lb/MWh** (the real published
  figure), `derivation` = `823.1 × 0.45359237 / 1000 = 0.37335… kg/kWh`,
  `assertionStyle` = `toBeCloseTo:0.373:3`. The conversion constant `0.45359237` (lb→kg) is the exact
  international value used by `packages/core/units`.

## Invariant enforced by the test suite

1. Every record validates against `factorRecordSchema`.
2. Keys are unique within a factor set; both sets cover transport + energy + diet.
3. A `toBe` record carries no `derivation` (it is published-exact).
4. A `toBeCloseTo:*` record carries both `sourceNative` and `derivation`.
5. Every derived `value` **reproduces** from its `sourceNative` via the recorded derivation and
   matches its `toBeCloseTo` target — so the table can never drift away from the published source.

## Adding a factor

- If the source quotes the number in the unit you compute in → set `value`, `assertionStyle: "toBe"`,
  no `derivation`.
- If you must convert → store the published figure in `sourceNative`, the arithmetic in `derivation`,
  the converted result in `value`, and `assertionStyle: "toBeCloseTo:<target>:<digits>"`. Then add the
  reproduction rule to `reproduceFromDerivation` in `seed.schema.test.ts` if a new native unit is
  introduced.
