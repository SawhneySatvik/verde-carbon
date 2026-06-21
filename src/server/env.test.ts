import { describe, it, expect } from "vitest";
import { loadEnv, EnvValidationError, appEnvSchema } from "./env";

describe("loadEnv — APP_ENV Zod schema (fail-fast, default-safe)", () => {
  it("defaults APP_ENV to 'local' when unset", () => {
    const env = loadEnv({});
    expect(env.APP_ENV).toBe("local");
  });

  it("accepts an explicit local value", () => {
    expect(loadEnv({ APP_ENV: "local" }).APP_ENV).toBe("local");
  });

  it("accepts gcp with a project id", () => {
    const env = loadEnv({ APP_ENV: "gcp", GCP_PROJECT_ID: "proj-1" });
    expect(env.APP_ENV).toBe("gcp");
    expect(env.GCP_PROJECT_ID).toBe("proj-1");
  });

  it("fails fast with a clear error on a garbage APP_ENV", () => {
    expect(() => loadEnv({ APP_ENV: "azure" })).toThrow(EnvValidationError);
    expect(() => loadEnv({ APP_ENV: "azure" })).toThrow(/APP_ENV/);
  });

  it("fails fast when APP_ENV=gcp but no project id is provided", () => {
    expect(() => loadEnv({ APP_ENV: "gcp" })).toThrow(EnvValidationError);
    expect(() => loadEnv({ APP_ENV: "gcp" })).toThrow(/GCP_PROJECT_ID/);
  });

  it("accepts gcp with only FIREBASE_PROJECT_ID", () => {
    const env = loadEnv({ APP_ENV: "gcp", FIREBASE_PROJECT_ID: "fb-1" });
    expect(env.APP_ENV).toBe("gcp");
  });

  it("exposes the APP_ENV enum for reuse", () => {
    expect(appEnvSchema.options).toEqual(["local", "gcp"]);
  });
});
