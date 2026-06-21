/**
 * Liveness/readiness probe for Cloud Run (ADR-005). The URL is `/api/health`
 * (NOT `/health`) so it matches the Cloud Run probe path and the smoke test.
 * Intentionally dependency-free: no auth, no DataPort, no AI — a probe must stay
 * cheap and must not fail because a downstream is degraded.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return Response.json(
    { status: "ok", service: "verde", time: new Date().toISOString() },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export function HEAD(): Response {
  return new Response(null, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
