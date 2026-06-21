import { describe, it, expect } from "vitest";
import { GET, HEAD } from "./route";

describe("GET /api/health — Cloud Run probe", () => {
  it("returns 200 with an ok status body", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("verde");
    expect(typeof body.time).toBe("string");
  });

  it("is not cached (probes must always re-check)", () => {
    expect(GET().headers.get("cache-control")).toBe("no-store");
  });

  it("HEAD returns 200 with no body", async () => {
    const res = HEAD();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});
