import type { SecretName, SecretsPort } from "@core/ports";

/**
 * The ONE sanctioned seam for reading a secret (OWASP Secrets Management).
 * Every call site resolves secrets through a {@link SecretsPort} — never
 * `process.env.GEMINI_API_KEY` directly, never a hard-coded literal. The local
 * and GCP secrets ADAPTERS are the only files allowed to touch the raw env for a
 * secret name; the hygiene gate (secrets.test.ts) fails the build on any other
 * raw secret-env read or embedded secret literal.
 */

export const SECRET_NAMES: readonly SecretName[] = [
  "GEMINI_API_KEY",
  "FIREBASE_SERVICE_ACCOUNT",
];

/** A secret value wrapped so it cannot be accidentally logged. */
export class Secret {
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  reveal(): string {
    return this.value;
  }

  /** Redacted in every string/log/JSON context so a secret never lands in logs. */
  toString(): string {
    return "[REDACTED]";
  }

  toJSON(): string {
    return "[REDACTED]";
  }
}

export async function requireSecret(
  secrets: SecretsPort,
  name: SecretName,
): Promise<Secret> {
  const value = await secrets.get(name);
  return new Secret(value);
}

export async function hasSecret(
  secrets: SecretsPort,
  name: SecretName,
): Promise<boolean> {
  return secrets.has(name);
}

/**
 * Redact secret values from an arbitrary string before it is logged. Defense in
 * depth for log lines that interpolate config — a known secret value is replaced
 * with `[REDACTED]` so it never reaches stdout/Cloud Logging.
 */
export function redactSecrets(
  message: string,
  values: readonly string[],
): string {
  let out = message;
  for (const value of values) {
    if (value.length > 0) {
      out = out.split(value).join("[REDACTED]");
    }
  }
  return out;
}
