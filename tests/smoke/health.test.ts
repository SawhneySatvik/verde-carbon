import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const STANDALONE_SERVER = fileURLToPath(
  new URL("../../.next/standalone/server.js", import.meta.url),
);

let server: ChildProcess | undefined;
let baseUrl = "";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (res.status === 200) {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    `Health endpoint did not become ready within ${timeoutMs}ms: ${String(lastErr)}`,
  );
}

beforeAll(async () => {
  // The smoke test exercises the SAME artifact the Dockerfile ships:
  // Next.js `output: "standalone"` (next.config.ts) -> node .next/standalone/server.js.
  // Build it if a prior `next build` hasn't produced it, so the check is
  // self-contained and runnable WITHOUT Docker.
  if (!existsSync(STANDALONE_SERVER)) {
    const build = spawnSync("npx", ["next", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, APP_ENV: "local" },
    });
    if (build.status !== 0) {
      throw new Error("`next build` failed; cannot run the health smoke test.");
    }
  }

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn("node", [STANDALONE_SERVER], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      APP_ENV: "local",
      NODE_ENV: "production",
    },
    stdio: "ignore",
  });
}, 240_000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 200));
    if (!server.killed) {
      server.kill("SIGKILL");
    }
  }
});

describe("health smoke — standalone server serves /api/health", () => {
  it("returns 200 with a JSON ok body", async () => {
    const res = await waitForHealth(baseUrl, 60_000);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; service?: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("verde");
  });

  it("answers HEAD probes with 200 (Cloud Run liveness)", async () => {
    const res = await fetch(`${baseUrl}/api/health`, { method: "HEAD" });
    expect(res.status).toBe(200);
  });
});
