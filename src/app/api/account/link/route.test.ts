import { describe, it, expect, beforeEach } from "vitest";
import type { Activity, Goal } from "@core/schemas";
import { InMemoryDataPort } from "@/server/adapters/local/data";
import { MockAuthPort } from "@/server/adapters/local/auth";
import { handlePost, type AccountLinkDeps } from "./route";

function authedReq(uid: string, body: unknown): Request {
  return new Request("https://verde.test/api/account/link", {
    method: "POST",
    headers: {
      authorization: `Bearer ${uid}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function activity(id: string): Activity {
  return {
    id,
    ts: 1000,
    category: "transport",
    activity: "drove",
    quantity: 1,
    unit: "gallon",
    factorKey: "transport.car.gasoline",
    factorSet: "EPA",
    factorSetVersion: "EPA-GHG-Hub-2025.1",
    co2eKg: 8.78,
    source: {
      name: "EPA",
      url: "https://example.com",
      edition: "2025",
      publishedYear: 2025,
    },
    origin: "nl",
  };
}

function goal(id: string): Goal {
  return {
    id,
    type: "reduction",
    targetPct: 10,
    baselineKg: 100,
    period: "monthly",
    createdAt: 0,
    active: true,
  };
}

describe("POST /api/account/link — happy-path link", () => {
  let auth: MockAuthPort;
  let data: InMemoryDataPort;
  let deps: AccountLinkDeps;
  let anonUid: string;

  beforeEach(async () => {
    auth = new MockAuthPort();
    data = new InMemoryDataPort();
    deps = { auth, data };
    anonUid = (await auth.signInAnonymously()).uid;
  });

  it("401 without a token", async () => {
    const res = await handlePost(
      new Request("https://verde.test/api/account/link", {
        method: "POST",
        body: JSON.stringify({
          action: "link",
          credential: { provider: "google", token: "t" },
        }),
      }),
      deps,
    );
    expect(res.status).toBe(401);
  });

  it("links an unused credential preserving the SAME uid (no migration)", async () => {
    const res = await handlePost(
      authedReq(anonUid, {
        action: "link",
        credential: { provider: "google", token: "fresh-token" },
      }),
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("linked");
    expect(body.uid).toBe(anonUid);
  });

  it("rejects a malformed body (400)", async () => {
    const res = await handlePost(authedReq(anonUid, { action: "link" }), deps);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/account/link — conflict + idempotent atomic merge", () => {
  let auth: MockAuthPort;
  let data: InMemoryDataPort;
  let deps: AccountLinkDeps;
  let anonUid: string;
  const existingUid = "existing-user-123";

  beforeEach(async () => {
    auth = new MockAuthPort({
      credentials: [
        {
          credential: { provider: "google", token: "taken-token" },
          uid: existingUid,
        },
      ],
    });
    data = new InMemoryDataPort();
    deps = { auth, data };
    anonUid = (await auth.signInAnonymously()).uid;
    // Anon has data; the existing target has its own activity already.
    await data.addActivity(anonUid, activity("anon-a1"));
    await data.setGoal(anonUid, goal("anon-g1"));
    await data.addActivity(existingUid, activity("existing-a1"));
  });

  it("surfaces credential-already-in-use (keep-vs-merge), leaving anon data intact", async () => {
    const res = await handlePost(
      authedReq(anonUid, {
        action: "link",
        credential: { provider: "google", token: "taken-token" },
      }),
      deps,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("credential-already-in-use");
    expect(body.existingUid).toBe(existingUid);
    expect(body.anonymousUid).toBe(anonUid);
    // Anon data is untouched by surfacing the choice.
    expect(await data.listActivities(anonUid)).toHaveLength(1);
  });

  it("CANCEL (keep) leaves anon data intact and does not merge", async () => {
    const res = await handlePost(
      authedReq(anonUid, {
        action: "resolve",
        resolution: "keep",
      }),
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("kept");
    // Target was NOT merged into; anon data is still there.
    expect(await data.listActivities(existingUid)).toHaveLength(1);
    expect(await data.listActivities(anonUid)).toHaveLength(1);
  });

  it("MERGE copies anon subcollections into the credential-verified target", async () => {
    const res = await handlePost(
      authedReq(anonUid, {
        action: "resolve",
        resolution: "merge",
        credential: { provider: "google", token: "taken-token" },
        targetUid: existingUid,
        idempotencyKey: `merge:${anonUid}->${existingUid}`,
      }),
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("merged");
    expect(body.targetUid).toBe(existingUid);
    expect(body.summary.copiedActivities).toBe(1);
    expect(body.summary.copiedGoals).toBe(1);
    expect(body.summary.idempotentReplay).toBe(false);

    const targetActivities = await data.listActivities(existingUid);
    expect(targetActivities.map((a) => a.id).sort()).toEqual([
      "anon-a1",
      "existing-a1",
    ]);
    expect((await data.listGoals(existingUid)).map((g) => g.id)).toEqual([
      "anon-g1",
    ]);
  });

  it("MERGE run TWICE with the SAME idempotencyKey does NOT double-write", async () => {
    const key = `merge:${anonUid}->${existingUid}`;
    const reqBody = {
      action: "resolve" as const,
      resolution: "merge" as const,
      credential: { provider: "google", token: "taken-token" },
      targetUid: existingUid,
      idempotencyKey: key,
    };

    const first = await handlePost(authedReq(anonUid, reqBody), deps);
    const firstBody = await first.json();
    expect(firstBody.summary.idempotentReplay).toBe(false);
    expect(firstBody.summary.copiedActivities).toBe(1);

    const second = await handlePost(authedReq(anonUid, reqBody), deps);
    const secondBody = await second.json();
    // The replay is recognized — no second copy, no double-write.
    expect(secondBody.status).toBe("merged");
    expect(secondBody.summary.idempotentReplay).toBe(true);

    // The target still holds exactly anon-a1 + existing-a1 (NOT duplicated).
    const targetActivities = await data.listActivities(existingUid);
    expect(targetActivities).toHaveLength(2);
    expect(targetActivities.map((a) => a.id).sort()).toEqual([
      "anon-a1",
      "existing-a1",
    ]);
    expect(await data.listGoals(existingUid)).toHaveLength(1);
  });

  /**
   * SECURITY (#3): the merge target is caller-controlled in the body, but the
   * server must bind it to the credential's verified owner. A caller cannot merge
   * their anon data into an arbitrary uid they never proved ownership of.
   */
  it("REJECTS (403) a merge into a uid the caller did NOT prove ownership of", async () => {
    const VICTIM_UID = "victim-uid-999";
    await data.addActivity(VICTIM_UID, activity("victim-a1"));

    const res = await handlePost(
      authedReq(anonUid, {
        action: "resolve",
        resolution: "merge",
        // The caller presents the credential they DO own, but points the target
        // at an unrelated victim uid.
        credential: { provider: "google", token: "taken-token" },
        targetUid: VICTIM_UID,
        idempotencyKey: `evil:${anonUid}->${VICTIM_UID}`,
      }),
      deps,
    );
    expect(res.status).toBe(403);
    // The victim's data is untouched; the anon data did NOT cross over.
    const victim = await data.listActivities(VICTIM_UID);
    expect(victim.map((a) => a.id)).toEqual(["victim-a1"]);
  });

  it("REJECTS (403) a merge whose credential is not bound to a separate account", async () => {
    const res = await handlePost(
      authedReq(anonUid, {
        action: "resolve",
        resolution: "merge",
        // A fresh, unused credential — there is no conflicting owner to merge into.
        credential: { provider: "google", token: "fresh-unused-token" },
        targetUid: existingUid,
        idempotencyKey: `nope:${anonUid}->${existingUid}`,
      }),
      deps,
    );
    expect(res.status).toBe(403);
    // No data was merged into the (unverified) target.
    expect(await data.listActivities(existingUid)).toHaveLength(1);
  });
});
