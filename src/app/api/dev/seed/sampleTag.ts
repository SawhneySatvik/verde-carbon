/**
 * Shared, dependency-free tag for demo-seeded data. Kept in its own module so the
 * CLIENT dashboard can detect "sample data is present" (id prefix) WITHOUT importing
 * the server route (and its server-only deps). The route re-exports these.
 */

/** Stable prefix that marks a row as demo-seeded so clear removes only those. */
export const SAMPLE_ID_PREFIX = "sample-";

/** Fixed id for the optional seeded reduction goal (so re-seed is idempotent). */
export const SAMPLE_GOAL_ID = "sample-goal-reduction";

/** True when an activity/goal id was created by the sample seeder. */
export function isSampleId(id: string): boolean {
  return id.startsWith(SAMPLE_ID_PREFIX);
}
