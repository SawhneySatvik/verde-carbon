// src/server — adapters + composition root (ADR-002, ADR-005).
// The composition root (container.ts) reads APP_ENV and wires the local or GCP
// adapter set behind the core ports.
export { createContainer, type AdapterSet } from "./container";
export { loadEnv, type ServerEnv, type AppEnv } from "./env";
