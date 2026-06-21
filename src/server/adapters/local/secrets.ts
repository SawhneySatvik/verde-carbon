import type { SecretName, SecretsPort } from "@core/ports";

/**
 * Local Secrets adapter (ADR-002): resolves secrets from `.env.local` /
 * process.env so `npm run dev` needs no Secret Manager and makes zero GCP
 * calls. Secret values are never logged; callers reach them only via this port.
 */
export class EnvSecretsPort implements SecretsPort {
  private readonly env: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env;
  }

  async get(name: SecretName): Promise<string> {
    const value = this.env[name];
    if (value === undefined || value.length === 0) {
      throw new Error(
        `Missing secret "${name}" in the local environment. Set it in .env.local.`,
      );
    }
    return value;
  }

  async has(name: SecretName): Promise<boolean> {
    const value = this.env[name];
    return value !== undefined && value.length > 0;
  }
}
