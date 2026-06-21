# Security

Verdé is anonymous-first and treats every request — and every model response — as untrusted. The controls below are implemented in code and exercised by tests.

## Authentication & authorization

- Every API route resolves the caller's identity server-side via the `AuthPort` and **never trusts a client-supplied uid** ([`src/server/http/authz.ts`](src/server/http/authz.ts)).
- In GCP mode, the bearer is a Firebase ID token verified with `verifyIdToken`; `POST /api/session` verify-and-echoes it and never mints a server-side user ([`src/app/api/session/route.ts`](src/app/api/session/route.ts)).
- Firestore security rules enforce `request.auth.uid == uid` on every user document and subcollection; server-only idempotency receipts are unreadable by clients ([`firestore.rules`](firestore.rules), [`docs/adr/ADR-004`](docs/adr/ADR-004-firestore-document-model-anon.md)).

## Input & AI-output validation

- **All request input** is validated with Zod; a malformed body is a `400`, never trusted ([`src/server/http/validate.ts`](src/server/http/validate.ts)).
- **All AI output** is re-validated with Zod server-side. The parse schema cannot carry a CO₂e number; the coach/insights phrasing is validated to be a short, **digit-free** string. An unvalidatable model response routes to a structured fallback (`502 invalid_ai_output`), never to a guessed number ([`packages/core/schemas/ai-parse.schema.ts`](packages/core/schemas/ai-parse.schema.ts)).
- **Second-order injection defense:** previously-logged free text is fed back to the model only as _data_, capped in length, and the reply is re-validated digit-free — a planted instruction or number has nowhere to land. A test re-feeds logged text through the insights model to assert only calculator numbers are used.

## Abuse & cost controls

- A fast-path in-memory token-bucket limiter throttles per-uid bursts ([`src/server/http/rateLimit.ts`](src/server/http/rateLimit.ts)).
- A **persisted per-uid daily AI quota** in the DataPort is the multi-instance correctness floor — requests on different Cloud Run instances cannot bypass it ([`src/server/http/aiQuota.ts`](src/server/http/aiQuota.ts)).
- Hard request-size and AI-input caps reject oversized payloads (`413`) before any model call; images are byte-capped after base64 decode.

## Secrets

- All secrets are read through the `SecretsPort` — **never** hardcoded, never logged. Secret Manager in production; `.env.local` locally ([`src/server/secrets/`](src/server/secrets/)).
- A build-time test scans `src/` and `packages/core/` for hardcoded key patterns and raw `process.env` secret reads outside the adapter seams, failing CI on a leak ([`src/server/secrets/secrets.test.ts`](src/server/secrets/secrets.test.ts)).
- The committed `.env.local.example` contains no secrets; real env files are gitignored.

## Data handling

- Free-text fields are sanitized on store to prevent stored XSS.
- No `dangerouslySetInnerHTML`, `eval`, or dynamic code execution anywhere in the app.

## Reporting

This is a hackathon submission, not a production service. For any security concern, open an issue on the repository.
