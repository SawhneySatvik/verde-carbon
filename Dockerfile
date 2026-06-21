# syntax=docker/dockerfile:1
# Multi-stage build for Verdé: Next.js `output: "standalone"` produces a
# self-contained server with only the runtime deps it traces, so the final image
# is minimal. Runs as a non-root user, is PORT-aware for Cloud Run, and serves
# /api/health for the startup/liveness probe.
#
# The app defaults to APP_ENV=local, so this image boots and runs the full app
# with no secrets or external services. Set APP_ENV=gcp (plus the GCP/Firebase/
# Gemini config in infra/cloudrun.yaml) to use Firestore + live Gemini instead.

# ---- deps: install production-resolvable node_modules from the lockfile ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the standalone server + static assets ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# APP_ENV is provided at runtime (Cloud Run); the build itself is env-agnostic.
RUN npm run build

# ---- runner: minimal runtime image, non-root ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Cloud Run injects PORT; the standalone server reads process.env.PORT/HOSTNAME.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# `standalone` already contains the traced node_modules + server.js. The static
# assets and public/ are not copied into standalone by Next, so add them here.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

# Self-contained liveness check inside the image (the probe path matches the
# Cloud Run manifest and the smoke test).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
