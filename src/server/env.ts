import { z } from "zod";

/**
 * Validated server environment. `APP_ENV` selects the adapter set and
 * DEFAULTS to `local` so a bare checkout runs the full core loop with zero GCP
 * (ADR-002). GCP fields are optional here and only required when APP_ENV=gcp;
 * a garbage APP_ENV fails fast with a clear, actionable error.
 */
export const appEnvSchema = z.enum(["local", "gcp"]);
export type AppEnv = z.infer<typeof appEnvSchema>;

const envSchema = z
  .object({
    APP_ENV: appEnvSchema.default("local"),
    GCP_PROJECT_ID: z.string().min(1).optional(),
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.APP_ENV === "gcp" &&
      !value.GCP_PROJECT_ID &&
      !value.FIREBASE_PROJECT_ID
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GCP_PROJECT_ID"],
        message:
          "APP_ENV=gcp requires GCP_PROJECT_ID or FIREBASE_PROJECT_ID to be set.",
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Parse + validate process env. Throws an {@link EnvValidationError} with a
 * readable summary on missing/garbage values — fail-fast, never silently fall
 * back to a wrong provider.
 */
export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new EnvValidationError(`Invalid server environment — ${summary}`);
  }
  return result.data;
}
