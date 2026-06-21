import type { NextConfig } from "next";

// `output: "standalone"` powers the self-hosted Docker image (Cloud Run). Vercel
// uses its own build pipeline, so standalone is skipped there (detected via the
// VERCEL env var) — the same source deploys cleanly to both targets.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
