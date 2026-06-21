# Verdé — Operational Runbook

> Operational reference for running, deploying, and recovering Verdé — a
> Next.js 15 carbon-footprint app.
> **Nothing here is applied automatically.** These are artifacts + procedures.
> Every `gcloud` / `firebase` command below uses placeholders you substitute.

**Stack:** Next.js 15 (App Router, `output: "standalone"`) → single container →
Cloud Run. Local-first via the `APP_ENV=local|gcp` adapter switch
(`src/server/env.ts`, `src/server/container.ts`). Persistence: Firestore.
Auth: Firebase / Identity Platform (anonymous-first). AI: Gemini.

**Placeholders used throughout:**

| Placeholder  | Meaning                              | Example                                            |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| `PROJECT_ID` | GCP project id                       | `verde-prod`                                       |
| `REGION`     | Cloud Run + Artifact Registry region | `us-central1`                                      |
| `REPO`       | Artifact Registry repo name          | `verde`                                            |
| `SERVICE`    | Cloud Run service name               | `verde`                                            |
| `RUNTIME_SA` | Cloud Run runtime service account    | `verde-runtime@PROJECT_ID.iam.gserviceaccount.com` |

---

## 1. Local development (no GCP)

The default checkout runs the entire core loop with the LOCAL adapter set
(in-memory data, mock anonymous auth, recorded AI fixtures) and makes **zero GCP
calls** (ADR-002). No credentials, no project, no network to Google.

```bash
# 1. Install (Node >= 22 required — see package.json engines).
npm install

# 2. (optional) env file — the default APP_ENV is already `local`.
cp .env.local.example .env.local      # leave APP_ENV=local

# 3. Run the dev server.
npm run dev                            # http://localhost:3000, APP_ENV=local
```

`APP_ENV` defaults to `local` if unset, so a bare `npm run dev` is GCP-free. The
local container is memoised process-wide so a just-minted anon session and logged
activities persist across requests (`src/server/container.ts`).

### Test suites

```bash
# Unit + integration (Vitest node + ui projects).
npx vitest run

# Unit with coverage (includes the pure calculator in packages/core/**).
npx vitest run --coverage

# Smoke: builds the standalone output and boots node .next/standalone/server.js,
# asserting /api/health returns 200 — the SAME artifact the Dockerfile ships.
npx vitest run --project smoke        # APP_ENV=local

# Bundle-size gate (enforced; budget in .size-limit.json).
npm run build && npm run size

# End-to-end (Playwright + axe a11y, chromium).
npx playwright install --with-deps chromium   # first time only
npm run test:e2e                              # APP_ENV=local
```

### Firestore rules tests (emulator — needs Java)

The `tests/rules` suite **self-skips** when no emulator is present and runs for
real inside `firebase emulators:exec` (which sets `FIRESTORE_EMULATOR_HOST`).
This requires a **JDK** and `firebase-tools`. Pin the tools version to your Java:

- **Java 20** → `firebase-tools@13`
- **Java 21+** → `firebase-tools@15`

```bash
java -version                          # confirm a JDK is installed

# Java 20:
npm install --no-save firebase-tools@13
# Java 21+:
npm install --no-save firebase-tools@15

# Run the gated rules suite (cross-uid deny, merge idempotency, batch boundary)
# against real Firestore transaction semantics.
npx firebase emulators:exec --only firestore "npx vitest run tests/rules"
```

The emulator config is in `firebase.json` (Firestore emulator on port 8080, UI
disabled).

---

## 2. Deploy to Cloud Run

There are two ways to deploy:

- **A — Zero-config demo (recommended first):** deploy the repo as-is with no env
  vars. `APP_ENV` defaults to `local`, so the container boots and runs the full
  app with in-memory data, mock anonymous auth, and recorded AI fixtures — **no
  secrets, no Firebase, no Gemini key**. See "Quickest path" below.
- **B — GCP-backed (production):** `APP_ENV=gcp` swaps in Firestore + Firebase
  Auth + live Gemini. See sections 2.1–2.9 and the
  [pre-deploy checklist](#3-pre-deploy-checklist-full-gcp-mode).

### Quickest path — zero-config demo (local mode)

The root `Dockerfile` is auto-detected by Cloud Build, so connecting the GitHub
repo in the Cloud Run console — or a single command — deploys a working demo:

```bash
gcloud run deploy verde --source . --region REGION --allow-unauthenticated
```

No environment variables are needed (`APP_ENV` defaults to `local`). The service
serves `/api/health` for the startup probe and the full UI loop works immediately.
Data is in-memory (not durable across instance restarts) — fine for a demo; use
mode B below for persistence.

### 2.0 Prerequisites (GCP-backed)

```bash
gcloud --version          # Google Cloud SDK
gcloud auth login
gcloud auth configure-docker REGION-docker.pkg.dev   # for image push
```

### 2.1 Create / select project

```bash
gcloud projects create PROJECT_ID            # or skip if it exists
gcloud config set project PROJECT_ID
# Link a billing account (required for Cloud Run / Firestore / Gemini):
gcloud billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### 2.2 Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  identitytoolkit.googleapis.com \
  cloudbuild.googleapis.com \
  generativelanguage.googleapis.com
```

(`identitytoolkit.googleapis.com` = Identity Platform / Firebase Auth;
`generativelanguage.googleapis.com` = Gemini API.)

### 2.3 Create the Firestore database

Verdé uses Firestore in **Native mode**, single region.

```bash
gcloud firestore databases create --location=REGION
```

### 2.4 Deploy security rules + indexes

These are committed at the repo root (`firestore.rules`, `firestore.indexes.json`,
wired by `firebase.json`). Deploy them with the Firebase CLI:

```bash
firebase use PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` is the defense-in-depth wall: every user doc is keyed by uid
and denied unless `request.auth.uid == uid`; the server-only `_batches` /
`_merges` receipts fall through to a final deny (ADR-004). The two composite
indexes back the activities-by-category and activities-by-time queries.

### 2.5 Create the runtime service account

```bash
gcloud iam service-accounts create verde-runtime \
  --display-name="Verde Cloud Run runtime"

# Firestore read/write:
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:RUNTIME_SA" \
  --role="roles/datastore.user"

# Firebase Auth admin (createUser / verifyIdToken / linkWithCredential):
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:RUNTIME_SA" \
  --role="roles/firebaseauth.admin"
```

### 2.6 Store the Gemini key in Secret Manager

```bash
printf '%s' 'YOUR_REAL_GEMINI_API_KEY' | \
  gcloud secrets create gemini-api-key --data-file=-

# Grant the runtime SA read access to ONLY this secret:
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor"
```

Never echo the key into shell history other than the one-shot pipe above; rotate
with `gcloud secrets versions add gemini-api-key --data-file=-`.

### 2.7 Build + push the image to Artifact Registry

```bash
# One-time: create the Docker repo.
gcloud artifacts repositories create REPO \
  --repository-format=docker --location=REGION

# The root Dockerfile produces the standalone runtime image and is auto-detected.
# Option A — Cloud Build (no local Docker daemon needed):
gcloud builds submit \
  --tag REGION-docker.pkg.dev/PROJECT_ID/REPO/verde:VERSION .

# Option B — local Docker:
docker build -t REGION-docker.pkg.dev/PROJECT_ID/REPO/verde:VERSION .
docker push REGION-docker.pkg.dev/PROJECT_ID/REPO/verde:VERSION
```

Use an **immutable tag** (`VERSION` = git short SHA or a release number), not
`:latest`, so rollbacks point at a known image. `infra/cloudrun.yaml` currently
references `:latest`; override it at deploy time (see 2.8).

### 2.8 Deploy

**Option A — declarative manifest (`infra/cloudrun.yaml`):**

```bash
# Substitute placeholders in the manifest first (PROJECT_ID, REGION, image tag,
# service account), then:
gcloud run services replace infra/cloudrun.yaml --region REGION
```

**Option B — imperative (equivalent), recommended for the first cut so flags are
explicit:**

```bash
gcloud run deploy SERVICE \
  --image=REGION-docker.pkg.dev/PROJECT_ID/REPO/verde:VERSION \
  --region=REGION \
  --service-account=RUNTIME_SA \
  --set-env-vars=APP_ENV=gcp,NODE_ENV=production,GCP_PROJECT_ID=PROJECT_ID,FIREBASE_PROJECT_ID=PROJECT_ID \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80 \
  --cpu=1 --memory=512Mi \
  --no-cpu-throttling \
  --port=8080 \
  --allow-unauthenticated
```

`APP_ENV=gcp` is what flips the container onto the Firestore / Firebase / Secret
Manager / Gemini adapters (`src/server/container.ts`). `--min-instances=1` is a
correctness floor, not just latency — see [Configuration](#5-configuration--secrets).

### 2.9 Verify the deploy

```bash
URL=$(gcloud run services describe SERVICE --region REGION --format='value(status.url)')
curl -fsS "$URL/api/health"     # -> {"status":"ok","service":"verde",...}
```

---

## 3. Pre-deploy checklist (full GCP mode)

The **zero-config demo deploy** (`APP_ENV=local`, section 2.0) needs none of this.
The items below apply only to a **GCP-backed** deploy (`APP_ENV=gcp` with
Firestore + Firebase Auth + live Gemini).

### Anonymous session auth in GCP mode

`POST /api/session` (`src/app/api/session/route.ts`, `handlePost`) **verifies and
echoes** the client's Firebase ID token under `APP_ENV=gcp`, and only provisions a
session server-side under `APP_ENV=local`. This closes the abuse vector where a
server-side mint would call `FirebaseAuth.createUser` for unauthenticated callers.
To run the full GCP loop, the browser must obtain its bearer by signing in with
the Firebase Web SDK (`signInAnonymously()` / `linkWithCredential`) using the
`NEXT_PUBLIC_FIREBASE_*` config, then send it as `Authorization: Bearer <token>`.

### Account-link merge target (server-verified)

The account-link merge (`src/app/api/account/link/route.ts`) never trusts the
client `targetUid`: the target is re-derived server-side from the verified
credential owner via the AuthPort, and a mismatched `targetUid` is rejected 403.
This path is exercised by the rules/merge tests under the emulator.

### Dependency advisories — monitor, do not force-fix

`npm audit` may report moderate transitive advisories. **Do NOT run
`npm audit fix --force`** — it pulls breaking major bumps not worth the regression
risk for moderate, transitive advisories. Upgrade only when a direct, non-breaking
fix or a real (non-transitive) exploit path appears.

```bash
npm audit --omit=dev          # review the current set
```

### Deploy prerequisites

- [ ] CI green on the target ref (lint, typecheck, unit, rules-under-emulator,
      smoke, e2e, bundle-size, docker-build).
- [ ] `firestore.rules` + `firestore.indexes.json` deployed (section 2.4).
- [ ] `gemini-api-key` exists in Secret Manager and the runtime SA can read it.
- [ ] `RUNTIME_SA` has `datastore.user` + `firebaseauth.admin`.
- [ ] Image is deployed with an **immutable tag** (not `:latest`).

---

## 4. Health & observability

### Health probe

- **Endpoint:** `GET /api/health` (NOT `/health`) — dependency-free, no auth, no
  DataPort, no AI (`src/app/api/health/route.ts`). Returns
  `{"status":"ok","service":"verde","time":...}` with 200.
- It is the **startup** and **liveness** probe path in `infra/cloudrun.yaml`, the
  Docker `HEALTHCHECK` path, and the smoke-test path — all aligned.

```bash
curl -fsS "$URL/api/health"
```

### Logs

Cloud Run captures stdout/stderr to **Cloud Logging** automatically.

```bash
# Tail live:
gcloud beta run services logs tail SERVICE --region REGION

# Read recent:
gcloud run services logs read SERVICE --region REGION --limit=200

# Structured query (errors only) in Logging:
gcloud logging read \
  'resource.type=cloud_run_revision AND resource.labels.service_name="SERVICE" AND severity>=ERROR' \
  --limit=100 --freshness=1h
```

Secrets (the Gemini key) are never logged — they are reachable only through the
SecretsPort.

### Metrics

Cloud Run emits request count, request latencies (p50/p95/p99), instance count,
and CPU/memory utilization to **Cloud Monitoring** out of the box (metric prefix
`run.googleapis.com/`). Build dashboards / alerts from:

- `run.googleapis.com/request_count` (filter by `response_code_class`)
- `run.googleapis.com/request_latencies`
- `run.googleapis.com/container/instance_count`
- `run.googleapis.com/container/memory/utilizations`

### AI-quota counter

The per-anon-uid daily AI quota is a **persisted Firestore counter** under
`users/{uid}/counters/{name}` (`getCounter` / `incrementCounter` in
`src/server/adapters/gcp/data.ts`). Because it is persisted (not in-process), it
is correct across multiple instances — that is what makes `min-instances >= 1`
and `max-instances > 1` safe. To inspect a user's current quota usage, read their
`counters` doc in the Firestore console. A sudden cluster-wide spike in Gemini
calls without a matching activity-log increase is the signal to investigate
prompt-injection / abuse.

### Alerts (define in Cloud Monitoring before prod)

| Alert                     | Condition                                                                     | Severity                 |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| **Error-rate spike**      | 5xx rate (`request_count{response_code_class="5xx"}` / total) > 5% over 5 min | **critical** (page)      |
| **Latency p99 high**      | `request_latencies` p99 > 2000 ms over 10 min                                 | **warning**              |
| **No healthy instances**  | `instance_count` (active) == 0 while traffic > 0                              | **critical** (page)      |
| **AI-quota / cost surge** | Gemini request volume > N× the 7-day baseline over 15 min                     | **warning** (cost/abuse) |
| **Secret access failure** | log-based: `Secret "GEMINI_API_KEY" is not available` appears                 | **critical**             |

---

## 5. Configuration & secrets

| Env var                  | Purpose                                                                                   | Source                                                                      | Default                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| `APP_ENV`                | Adapter switch: `local` \| `gcp`. `gcp` selects Firestore/Firebase/Secret Manager/Gemini. | Runtime env (`--set-env-vars`); manifest sets `gcp`                         | `local`                                   |
| `NODE_ENV`               | Standard prod flag.                                                                       | Dockerfile runner + runtime env                                             | `production` (image)                      |
| `GCP_PROJECT_ID`         | Project for Firestore / Artifact Registry / Secret Manager.                               | Runtime env                                                                 | — (required if `APP_ENV=gcp`)             |
| `FIREBASE_PROJECT_ID`    | Firebase / Identity Platform project (anon auth + link).                                  | Runtime env                                                                 | — (one of GCP*/FIREBASE* required if gcp) |
| `GEMINI_API_KEY`         | Gemini API access (server-side only).                                                     | **Secret Manager** via `--set-secrets=GEMINI_API_KEY=gemini-api-key:latest` | —                                         |
| `GEMINI_MODEL`           | Override Gemini model.                                                                    | Runtime env (optional)                                                      | adapter default                           |
| `NEXT_PUBLIC_FIREBASE_*` | Public Firebase web config for the browser SDK (anon auth/link).                          | **Build-time** env (baked into client bundle)                               | —                                         |
| `PORT` / `HOSTNAME`      | Standalone server bind.                                                                   | Injected by Cloud Run / set in Dockerfile (`8080` / `0.0.0.0`)              | `8080` / `0.0.0.0`                        |

`src/server/env.ts` validates these with Zod and **fails fast**: `APP_ENV=gcp`
with neither `GCP_PROJECT_ID` nor `FIREBASE_PROJECT_ID` throws at boot.

See `infra/.env.gcp.example` for the full GCP-mode surface (no real values) and
`.env.local.example` for local.

**min-instances rationale (`--min-instances=1`):** the persisted per-anon-uid AI
quota (Firestore `counters`) is the **multi-instance correctness floor** — quota
and rate state live in Firestore, not process memory, so requests served by
different instances cannot bypass the daily AI cap or run cost away. That floor is
what makes running more than one instance safe; `min=1` then additionally removes
cold starts (ADR-005). If the limiter were ever in-memory-only, `max-instances`
would have to be pinned to 1.

---

## 6. Rollback

Cloud Run keeps every prior **revision**. Rollback = shift 100% traffic back to
the last-known-good revision. This is a true undo for the app tier (immutable
image + config snapshot per revision).

```bash
# List revisions, newest first:
gcloud run revisions list --service SERVICE --region REGION

# Send all traffic to a known-good revision:
gcloud run services update-traffic SERVICE --region REGION \
  --to-revisions=SERVICE-REVISION-XXXXX=100

# Or, if you used --to-latest before, pin away from latest explicitly above.
```

Verify after rollback:

```bash
URL=$(gcloud run services describe SERVICE --region REGION --format='value(status.url)')
curl -fsS "$URL/api/health"
```

**What rollback does and does NOT undo:**

- **Undone:** application code, container image, env var / secret-version
  bindings captured in the revision.
- **NOT undone — Firestore data & schema.** Firestore writes (activities, goals,
  counters, and especially the anon→sign-in **merge**, which is all-or-nothing
  and idempotent but **one-way**: it copies anon subcollections INTO the target
  account) are **not reverted** by a revision rollback. If a bad release wrote or
  merged data, rolling back the revision restores behaviour but the data stays.
  - Recovery path for data: the merge is **idempotent**, so re-running it is safe
    (no duplication). For genuine data corruption, restore from a
    **Firestore PITR / scheduled export** (set up `gcloud firestore export
gs://BUCKET` backups and/or enable PITR _before_ prod). There is no in-app
    "undo merge" — recovery is restore-from-backup, not revision rollback.
- **NOT undone — `firestore.rules` / indexes.** These are deployed separately
  (section 2.4). To roll them back, redeploy the previous committed
  `firestore.rules` / `firestore.indexes.json` from git:
  `git checkout <good-sha> -- firestore.rules firestore.indexes.json && firebase deploy --only firestore:rules,firestore:indexes`.
- **NOT undone — Secret Manager rotations.** Re-pin the env to a prior secret
  version if a rotation was the cause:
  `gcloud run services update SERVICE --region REGION --set-secrets=GEMINI_API_KEY=gemini-api-key:<VERSION>`.

---

## 7. Stop / scale down

Cloud Run has no "stop" — scale to zero, or remove traffic, or delete.

```bash
# Park it: allow scale to zero (drops min-instances; cold starts return).
gcloud run services update SERVICE --region REGION --min-instances=0

# Cut all traffic without deleting (emergency stop):
gcloud run services update-traffic SERVICE --region REGION --to-revisions=NONE || \
  gcloud run services update SERVICE --region REGION --no-traffic

# Full teardown (irreversible for the service object; Firestore data remains):
gcloud run services delete SERVICE --region REGION
```

---

## 8. Common incidents

### `/api/health` returns non-200 / startup probe failing

- **Diagnose:** `gcloud run services logs read SERVICE --region REGION --limit=100`.
  Look for `EnvValidationError` (bad/missing `APP_ENV` / project id) or a crash on
  boot. Confirm the image tag deployed is the one you built.
- **Mitigate:** roll back to the last-good revision (section 6). If it's an env
  problem, fix `--set-env-vars` / `--set-secrets` and redeploy.

### `Secret "GEMINI_API_KEY" is not available`

- **Diagnose:** the `--set-secrets` mapping is missing, or the runtime SA lacks
  `secretmanager.secretAccessor`, or the secret version was deleted.
- **Mitigate:** re-add `--set-secrets=GEMINI_API_KEY=gemini-api-key:latest`, grant
  the SA accessor (section 2.6), confirm a live version exists
  (`gcloud secrets versions list gemini-api-key`).

### 403 / permission-denied on Firestore or Auth

- **Diagnose:** missing `roles/datastore.user` or `roles/firebaseauth.admin` on
  `RUNTIME_SA`, or the wrong `GCP_PROJECT_ID`/`FIREBASE_PROJECT_ID`.
- **Mitigate:** re-bind roles (section 2.5); confirm the service is running as
  `RUNTIME_SA` (`gcloud run services describe ... --format='value(spec.template.spec.serviceAccountName)'`).

### AI-call / cost spike

- **Diagnose:** compare Gemini request volume vs activity-log growth; read the
  per-uid `counters` doc(s) in Firestore. A spike with flat activity logging
  suggests abuse / prompt injection.
- **Mitigate:** the persisted daily quota caps per-uid spend; if a key is leaked,
  rotate it (`gcloud secrets versions add gemini-api-key --data-file=-`) and
  redeploy to pick up `:latest`.

### Unexpected new Firebase users (post-deploy)

- **Diagnose:** if F4 shipped incompletely, a `POST /api/session` mint path could
  still run under gcp and create users. Check the session route for the
  `APP_ENV=gcp` guard.
- **Mitigate:** roll back to a revision without the mint path; complete the F4
  hardening before redeploying.

---

## 9. Capacity & cost

- **Baseline pod:** 1 vCPU, 512Mi (`infra/cloudrun.yaml`), concurrency 80,
  CPU-throttling off (steady AI/SSR latency). The `standalone` image is small
  (only traced runtime deps ship).
- **min-instances = 1** (always warm; correctness floor per section 5);
  **max-instances = 10** (cost ceiling — correctness is held by the persisted
  quota, not the instance count).
- **Scaling triggers:** Cloud Run autoscales on concurrent requests; at 80
  concurrency/instance, ~800 concurrent requests saturates the 10-instance
  ceiling — raise `--max-instances` if sustained traffic approaches that.
- **Cost drivers:** (1) always-on min-instance compute, (2) Gemini API calls
  (bounded per-uid by the persisted daily quota + context caching, ADR-005),
  (3) Firestore reads/writes. Watch the AI-quota / cost-surge alert.

```

```
