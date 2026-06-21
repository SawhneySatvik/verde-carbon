# ADR-004: Firestore document model & anonymous-uid → sign-in account linking

- **Status:** accepted
- **Date:** 2026-06-20
- **Decider:** Architecture

## Context

Anonymous users must be able to run the whole core loop and later sign in **without losing data**.
Data is per-user (privacy-by-design): baseline, activity logs, goals, streaks.
Firestore is the GCP data store but the model must also work behind the in-memory/emulator local
adapter, and the dashboard needs indexed, no-scan queries (efficiency NFR).

## Decision

Key all user data by the **Firebase uid** — which is the _anonymous_ uid until linking, and the
_same_ uid after `linkWithCredential` (anonymous-account linking preserves the uid), so **no data
migration is needed** on sign-in in the common case. Document model:

```
users/{uid}                      # profile: locale, factorSet, unitSystem, displayName?, isAnonymous
users/{uid}/activities/{id}      # { ts, category, activity, quantity, unit, factorKey, factorSet,
                                 #   factorSetVersion, co2eKg, source, origin: "nl"|"fallback"|"baseline" }
users/{uid}/goals/{id}           # { type, targetPct, baselineKg, period, createdAt, active }
users/{uid}/streaks/current      # { count, lastLoggedDate, longest }
users/{uid}/baseline             # { computedAt, totalKg, lineItems[] }
```

Composite indexes on `activities` by `(category, ts)` and `(ts)` back the trend/category queries.
**Link-conflict path** (the chosen identity already owns data): the app does not silently overwrite;
it surfaces the keep-vs-merge choice and, if merging, copies anon subcollections
into the target uid via the `DataPort` (transactional batch). The `DataPort` repository hides whether
this runs against the emulator/in-mem local adapter or Firestore.

## Alternatives considered

| Alternative                                            | Pros                                                 | Cons                                        | Why rejected                                          |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| Separate anon store, copy everything on sign-in        | Clear separation                                     | Always-migrate; data-loss risk; more code   | Linking preserves uid — usually no copy needed        |
| One flat `activities` collection with `uid` field      | Simple rules                                         | Weaker per-user isolation; broader queries  | Subcollections give cleaner per-user authz + indexing |
| uid-keyed subcollections + linkWithCredential (chosen) | No migration on the happy path; clean authz; indexed | Conflict case still needs an explicit merge | Matches the anonymous-first model                     |

## Consequences

- **Positive:** Anonymous → signed-in is seamless (same uid); per-user security rules are
  straightforward; queries are indexed and scan-free; the model maps cleanly onto the local adapter.
- **Negative:** The merge (conflict) path needs careful, tested transactional copying and a clear UX;
  Firestore security rules must enforce `request.auth.uid == uid` on every path.
- **Reversibility:** Moderate — document shape changes would need a migration.

## Validation

An e2e test: anonymous user logs activities + sets a goal, signs in, and all data is present
afterward (same uid, no copy); a second test exercises the conflict/merge path; security-rules tests
deny cross-uid access.
