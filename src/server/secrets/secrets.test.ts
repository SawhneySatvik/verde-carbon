import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import type { SecretsPort } from "@core/ports";
import {
  Secret,
  SECRET_NAMES,
  requireSecret,
  hasSecret,
  redactSecrets,
} from "./index";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SRC_ROOT = join(REPO_ROOT, "src");
const CORE_ROOT = join(REPO_ROOT, "packages", "core");

/**
 * Files allowed to touch a raw secret env value: the local + GCP SecretsPort
 * ADAPTERS are the single seam between `process.env` and the rest of the app.
 * Everything else must resolve secrets through the port.
 */
const ALLOWED_RAW_ENV_FILES = [
  join("src", "server", "adapters", "local", "secrets.ts"),
  join("src", "server", "adapters", "gcp", "secrets.ts"),
];

const SCAN_EXTENSIONS = [".ts", ".tsx"];

function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === "node_modules" || entry === ".next") {
          continue;
        }
        walk(full);
        continue;
      }
      if (!SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        continue;
      }
      if (/\.(test|spec)\.tsx?$/.test(entry)) {
        continue;
      }
      out.push(full);
    }
  }
  walk(root);
  return out;
}

/** Strip line + block comments so a documentation MENTION never trips the gate. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function relPath(file: string): string {
  return relative(REPO_ROOT, file).split(sep).join("/");
}

describe("Secret facade — never leaks the value", () => {
  it("redacts the value in toString / toJSON / template interpolation", () => {
    const s = new Secret("super-secret-token");
    expect(s.reveal()).toBe("super-secret-token");
    expect(String(s)).toBe("[REDACTED]");
    expect(`${s}`).toBe("[REDACTED]");
    expect(JSON.stringify({ key: s })).toBe('{"key":"[REDACTED]"}');
    expect(JSON.stringify({ key: s })).not.toContain("super-secret-token");
  });

  it("requireSecret / hasSecret resolve ONLY through the SecretsPort", async () => {
    const calls: string[] = [];
    const port: SecretsPort = {
      async get(name) {
        calls.push(name);
        return "value-for-" + name;
      },
      async has(name) {
        return name === "GEMINI_API_KEY";
      },
    };
    const secret = await requireSecret(port, "GEMINI_API_KEY");
    expect(secret.reveal()).toBe("value-for-GEMINI_API_KEY");
    expect(await hasSecret(port, "GEMINI_API_KEY")).toBe(true);
    expect(await hasSecret(port, "FIREBASE_SERVICE_ACCOUNT")).toBe(false);
    expect(calls).toEqual(["GEMINI_API_KEY"]);
  });

  it("redactSecrets scrubs known secret values from a log line", () => {
    const line = redactSecrets("calling gemini with key=AIzaTOPSECRET now", [
      "AIzaTOPSECRET",
    ]);
    expect(line).toBe("calling gemini with key=[REDACTED] now");
  });
});

describe("Secrets-hygiene gate (OWASP Secrets Management)", () => {
  const sourceFiles = [
    ...listSourceFiles(SRC_ROOT),
    ...listSourceFiles(CORE_ROOT),
  ];

  it("scans a non-trivial set of source files", () => {
    expect(sourceFiles.length).toBeGreaterThan(5);
  });

  it("NO raw process.env read of a secret name outside the SecretsPort adapters", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const rel = relPath(file);
      const isAllowed = ALLOWED_RAW_ENV_FILES.some(
        (a) => rel === a.split(sep).join("/"),
      );
      if (isAllowed) {
        continue;
      }
      const code = stripComments(readFileSync(file, "utf8"));
      for (const name of SECRET_NAMES) {
        const pattern = new RegExp(
          `process\\.env\\.${name}\\b|process\\.env\\[\\s*['"\`]${name}['"\`]\\s*\\]`,
        );
        if (pattern.test(code)) {
          offenders.push(`${rel}: raw process.env read of secret "${name}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("NO embedded secret literals (Gemini API key / PEM private key)", () => {
    const offenders: string[] = [];
    const SECRET_LITERAL_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
      ["Gemini API key literal", /['"`]AIza[0-9A-Za-z_-]{20,}['"`]/],
      ["PEM private key", /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/],
      ["service-account private_key field", /"private_key"\s*:\s*"-----BEGIN/],
    ];
    for (const file of sourceFiles) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const [label, pattern] of SECRET_LITERAL_PATTERNS) {
        if (pattern.test(code)) {
          offenders.push(`${relPath(file)}: ${label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the gate WOULD catch a planted violation (gate is not a no-op)", () => {
    const plantedRawEnv = "const k = process.env.GEMINI_API_KEY;";
    const rawEnvPattern = new RegExp(`process\\.env\\.GEMINI_API_KEY\\b`);
    expect(rawEnvPattern.test(stripComments(plantedRawEnv))).toBe(true);

    const plantedLiteral =
      'const k = "AIzaSyD-EXAMPLE-EXAMPLE-EXAMPLE-1234567";';
    expect(/['"`]AIza[0-9A-Za-z_-]{20,}['"`]/.test(plantedLiteral)).toBe(true);

    // A documentation MENTION inside a comment must NOT trip the gate.
    const commentMention =
      "// reads process.env.GEMINI_API_KEY (don't do this)";
    expect(rawEnvPattern.test(stripComments(commentMention))).toBe(false);
  });
});
