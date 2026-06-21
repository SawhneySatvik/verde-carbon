import type { SecretName, SecretsPort } from "@core/ports";

/**
 * GCP Secrets adapter (ADR-002, OWASP Secrets Management). Secret Manager
 * secrets are surfaced to the Cloud Run runtime via secret mounts / the
 * `--set-secrets` env injection (see infra/cloudrun.yaml), so this
 * adapter resolves them from the process environment WITHOUT pulling in the
 * `@google-cloud/secret-manager` SDK as a dependency. Values are never logged
 * and are reachable only through this port. If a future direct-API resolution
 * is needed, this adapter is the single seam to swap.
 */
export class SecretManagerSecretsPort implements SecretsPort {
  private readonly env: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env;
  }

  async get(name: SecretName): Promise<string> {
    const value = this.env[name];
    if (value === undefined || value.length === 0) {
      throw new Error(
        `Secret "${name}" is not available. Mount it from Secret Manager (--set-secrets) in the Cloud Run service.`,
      );
    }
    return value;
  }

  async has(name: SecretName): Promise<boolean> {
    const value = this.env[name];
    return value !== undefined && value.length > 0;
  }
}
