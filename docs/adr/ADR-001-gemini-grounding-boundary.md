# ADR-001: Gemini grounding — AI parses, the calculator computes (no AI-emitted numbers)

- **Status:** accepted
- **Date:** 2026-06-20
- **Decider:** Architecture

## Context

The hard product rule: **Gemini must never
invent or emit an emission number.** AI is only allowed to parse natural language and explain;
every CO2e value must come from a deterministic, unit-tested calculator over a vetted factor table.
LLMs, left unconstrained, will happily produce a plausible-but-wrong "≈ 5.2 kg CO2e" in free text.
We need a structural guarantee — not a prompt plea — that no AI-originated number can reach the UI.

## Decision

Constrain Gemini to **function-calling with a strict `responseSchema`** that returns only
`{ items: [{ activity, value, unit, candidateFactorKey, confidence }], clarification? }` — a schema
that has **no field capable of holding a CO2e number**. A separate, pure
`packages/core/calculator` module takes the validated parse, looks up the `candidateFactorKey` in
the seeded factor table, and computes CO2e as `quantity_in_canonical_unit × factor`. The parse is
Zod-validated server-side; any field outside the schema is rejected; the calculator is the **only**
producer of emission numbers in the system.

## Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Free-text prompt: "don't give numbers" | Trivial | No enforcement; model leaks numbers; untestable | Violates the hard rule; not auditable |
| Let AI return CO2e, validate the range | One round-trip | The number is still AI-invented; range checks can't make it correct or sourced | Defeats the entire product premise |
| AI returns parse + factor key; calculator computes (chosen) | Number provably from a vetted factor; fully testable; auditable provenance | Two layers; needs a factor-key vocabulary the model maps to | This is the point of the product |

## Consequences

- **Positive:** Every UI number is traceable to a factor + arithmetic; exact-value Vitest tests pin
  the calculator (1 gal gasoline = 8.78 kg, etc.); a test asserts the AI schema *cannot* carry a
  CO2e field; prompt-injection that asks for a number simply has nowhere to put it.
- **Negative:** The model must map free text onto a controlled `candidateFactorKey` vocabulary;
  ambiguous matches require a UX confirm step (already designed). Maintaining the key vocabulary is
  ongoing work.
- **Reversibility:** Easy to tighten/loosen the schema; one-way in spirit (relaxing it would break
  the product's core promise).

## Validation

A passing test suite where (a) calculator exact-value tests are green, (b) a guard test fails if the
AI response schema ever gains a numeric emission field, and (c) the AI adapter strips/ignores any
unexpected numeric field. If a CO2e ever renders without a corresponding calculator call, this
decision was violated.
