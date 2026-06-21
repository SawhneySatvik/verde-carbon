import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

export const PROJECT_ID = "verde-rules-test";

const RULES_PATH = fileURLToPath(
  new URL("../../firestore.rules", import.meta.url),
);

/**
 * `@firebase/rules-unit-testing` talks to a running Firestore emulator. Under CI
 * the suite runs inside `firebase emulators:exec`, which sets
 * FIRESTORE_EMULATOR_HOST. Locally (no Java/firebase-tools) the emulator is
 * absent, so we probe its host:port first and let callers skip honestly rather
 * than hang or fake a pass — the rules + transaction semantics are real and only
 * meaningful against the emulator.
 */
export function emulatorHost(): { host: string; port: number } {
  const fromEnv = process.env.FIRESTORE_EMULATOR_HOST;
  if (fromEnv) {
    const [host, port] = fromEnv.split(":");
    return { host: host || "127.0.0.1", port: Number(port) || 8080 };
  }
  return { host: "127.0.0.1", port: 8080 };
}

export async function isEmulatorReachable(): Promise<boolean> {
  const { host, port } = emulatorHost();
  try {
    const res = await fetch(`http://${host}:${port}/`, {
      signal: AbortSignal.timeout(750),
    });
    // The emulator answers any HTTP request (commonly 200/404/501); a response
    // at all proves it is up. A network/timeout error means it is not.
    return res.status > 0;
  } catch {
    return false;
  }
}

/**
 * Vitest runs test files in parallel against the one shared emulator, so each
 * file MUST use its own Firestore project namespace — otherwise one file's
 * `clearFirestore()` wipes data another file is mid-assertion on. Pass a unique
 * id per test file.
 */
export async function makeTestEnv(
  projectId: string = PROJECT_ID,
): Promise<RulesTestEnvironment> {
  const { host, port } = emulatorHost();
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules: readFileSync(RULES_PATH, "utf8"),
    },
  });
}
