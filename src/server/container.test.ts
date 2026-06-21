import { describe, it, expect, afterEach } from "vitest";
import { getApps } from "firebase-admin/app";
import { createContainer, resetLocalContainer } from "./container";
import { InMemoryDataPort } from "./adapters/local/data";
import { MockAuthPort } from "./adapters/local/auth";
import { EnvSecretsPort } from "./adapters/local/secrets";
import { RecordedAiPort } from "./adapters/local/ai";

describe("createContainer — APP_ENV selects the adapter set", () => {
  it("local mode wires the LOCAL adapters", async () => {
    const c = await createContainer({ APP_ENV: "local" });
    expect(c.appEnv).toBe("local");
    expect(c.data).toBeInstanceOf(InMemoryDataPort);
    expect(c.auth).toBeInstanceOf(MockAuthPort);
    expect(c.secrets).toBeInstanceOf(EnvSecretsPort);
    expect(c.ai).toBeInstanceOf(RecordedAiPort);
  });

  it("defaults to local when APP_ENV is unset", async () => {
    const c = await createContainer({});
    expect(c.appEnv).toBe("local");
    expect(c.data).toBeInstanceOf(InMemoryDataPort);
  });

  it("the local container is fully functional with zero GCP", async () => {
    const c = await createContainer({ APP_ENV: "local" });
    const identity = await c.auth.signInAnonymously();
    const parsed = await c.ai.parseActivity({ input: "drove 20 km" });
    expect(identity.isAnonymous).toBe(true);
    expect(parsed.items[0]?.candidateFactorKey).toBe("transport.car.gasoline");
  });
});

describe("ZERO GCP in local mode — automated assertion", () => {
  it("constructs NO firebase-admin App when APP_ENV=local", async () => {
    // No GCP client may be constructed in local mode. firebase-admin's getApps()
    // is empty iff initializeApp() was never called by any GCP adapter — so a
    // local container that touched a GCP adapter would fail this.
    const before = getApps().length;
    await createContainer({ APP_ENV: "local" });
    const after = getApps().length;
    expect(after).toBe(before);
    expect(after).toBe(0);
  });

  it("none of the local adapters are GCP adapters (no firebase/@google-cloud client)", async () => {
    const c = await createContainer({ APP_ENV: "local" });
    // The GCP adapter classes are never imported here; asserting on the local
    // instances + an empty firebase app registry is the zero-GCP proof.
    expect(c.data.constructor.name).toBe("InMemoryDataPort");
    expect(c.auth.constructor.name).toBe("MockAuthPort");
    expect(c.secrets.constructor.name).toBe("EnvSecretsPort");
    expect(c.ai.constructor.name).toBe("RecordedAiPort");
    expect(getApps()).toHaveLength(0);
  });

  it("fails fast (never silently picks GCP) on a garbage APP_ENV", async () => {
    await expect(createContainer({ APP_ENV: "bogus" })).rejects.toThrow(
      /APP_ENV/,
    );
    expect(getApps()).toHaveLength(0);
  });
});

describe("local container is a process-wide singleton (cross-request state)", () => {
  afterEach(() => {
    resetLocalContainer();
  });

  it("returns the SAME local adapter set across calls so in-mem data persists", async () => {
    const a = await createContainer({ APP_ENV: "local" });
    const b = await createContainer({ APP_ENV: "local" });
    // Same instances: a uid minted on one request resolves on the next, and a
    // logged activity is still there for the dashboard read (the whole e2e loop
    // depends on this).
    expect(a.data).toBe(b.data);
    expect(a.auth).toBe(b.auth);
  });

  it("a minted anon session is resolvable on a later container call", async () => {
    const first = await createContainer({ APP_ENV: "local" });
    const identity = await first.auth.signInAnonymously();
    const second = await createContainer({ APP_ENV: "local" });
    const resolved = await second.auth.getCurrentIdentity(identity.uid);
    expect(resolved?.uid).toBe(identity.uid);
  });

  it("resetLocalContainer() drops the singleton (test isolation seam)", async () => {
    const a = await createContainer({ APP_ENV: "local" });
    resetLocalContainer();
    const b = await createContainer({ APP_ENV: "local" });
    expect(a.data).not.toBe(b.data);
  });
});
