import type { AiPort, AuthPort, DataPort, SecretsPort } from "@core/ports";
import { loadEnv, type AppEnv, type ServerEnv } from "./env";
import { InMemoryDataPort } from "./adapters/local/data";
import { MockAuthPort } from "./adapters/local/auth";
import { EnvSecretsPort } from "./adapters/local/secrets";
import { RecordedAiPort } from "./adapters/local/ai";

export interface AdapterSet {
  appEnv: AppEnv;
  data: DataPort;
  auth: AuthPort;
  secrets: SecretsPort;
  ai: AiPort;
}

/**
 * Build the LOCAL adapter set. Imports ONLY local adapters (in-memory data,
 * mock anonymous auth, env secrets, recorded-fixture AI) — no firebase /
 * @google-cloud / @google/genai module is touched, so a local run makes zero
 * GCP calls (ADR-002). This is the function the "zero GCP in local mode"
 * assertion (container.test.ts) relies on.
 */
function buildLocalAdapters(env: ServerEnv): AdapterSet {
  return {
    appEnv: env.APP_ENV,
    data: new InMemoryDataPort(),
    auth: new MockAuthPort(),
    secrets: new EnvSecretsPort(),
    ai: new RecordedAiPort(),
  };
}

/**
 * Build the GCP adapter set. The GCP adapter modules (and therefore their
 * firebase / @google-cloud / @google/genai imports) are loaded LAZILY via
 * dynamic import, so they are never even loaded when APP_ENV=local.
 */
async function buildGcpAdapters(env: ServerEnv): Promise<AdapterSet> {
  const [
    { FirestoreDataPort },
    { FirebaseAuthPort },
    { SecretManagerSecretsPort },
    genaiModule,
    { GeminiAiPort },
  ] = await Promise.all([
    import("./adapters/gcp/data"),
    import("./adapters/gcp/auth"),
    import("./adapters/gcp/secrets"),
    import("@google/genai"),
    import("./adapters/gcp/ai"),
  ]);

  const projectId = env.GCP_PROJECT_ID ?? env.FIREBASE_PROJECT_ID;
  const appOptions = projectId !== undefined ? { projectId } : {};
  const secrets = new SecretManagerSecretsPort();
  const apiKey = await secrets.get("GEMINI_API_KEY");
  const client = new genaiModule.GoogleGenAI({ apiKey });

  return {
    appEnv: env.APP_ENV,
    data: new FirestoreDataPort(appOptions),
    auth: new FirebaseAuthPort(appOptions),
    secrets,
    ai: new GeminiAiPort(client, {
      ...(env.GEMINI_MODEL !== undefined && { model: env.GEMINI_MODEL }),
    }),
  };
}

/**
 * Process-wide singleton for the LOCAL adapter set.
 *
 * The local DataPort is in-memory and the local AuthPort holds the minted
 * anonymous sessions, so they MUST be shared across requests within a server
 * process — otherwise every Route Handler would build a fresh, empty store (a
 * just-minted anon token would be unknown to the next request, and logged
 * activities would vanish). Memoising the local set makes the anonymous core
 * loop hold together end-to-end against `npm run start`. The GCP set is
 * NOT memoised: its adapters are stateless clients over Firestore/Firebase, so a
 * fresh set per request is correct and avoids leaking process state.
 *
 * Keyed off `globalThis` so the store survives Next's dev module reloads (HMR)
 * within a single dev server rather than silently resetting on recompile.
 */
const LOCAL_CONTAINER_KEY = Symbol.for("verde.localContainer");

type GlobalWithContainer = typeof globalThis & {
  [LOCAL_CONTAINER_KEY]?: AdapterSet;
};

function getLocalContainer(env: ServerEnv): AdapterSet {
  const g = globalThis as GlobalWithContainer;
  if (!g[LOCAL_CONTAINER_KEY]) {
    g[LOCAL_CONTAINER_KEY] = buildLocalAdapters(env);
  }
  return g[LOCAL_CONTAINER_KEY];
}

/**
 * Reset the memoised local container. Test-only seam so suites that exercise the
 * container in isolation never bleed state into one another.
 */
export function resetLocalContainer(): void {
  const g = globalThis as GlobalWithContainer;
  delete g[LOCAL_CONTAINER_KEY];
}

/**
 * Composition root (ADR-002). Reads the validated env and returns the local or
 * GCP adapter set. Returns a Promise because the GCP branch resolves secrets and
 * lazily imports provider SDKs; the local branch resolves immediately with no
 * GCP module loaded.
 *
 * The local set is returned from a process-wide singleton (see
 * {@link getLocalContainer}) so in-memory data and minted anonymous sessions
 * persist across requests; the GCP set is built per call (stateless clients).
 */
export async function createContainer(
  source: Record<string, string | undefined> = process.env,
): Promise<AdapterSet> {
  const env = loadEnv(source);
  if (env.APP_ENV === "gcp") {
    return buildGcpAdapters(env);
  }
  return getLocalContainer(env);
}
