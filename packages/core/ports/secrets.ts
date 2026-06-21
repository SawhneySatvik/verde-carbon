export type SecretName = "GEMINI_API_KEY" | "FIREBASE_SERVICE_ACCOUNT";

export interface SecretsPort {
  get(name: SecretName): Promise<string>;
  has(name: SecretName): Promise<boolean>;
}
