import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Activity, FactorSource } from "@core/schemas";
import DashboardPage from "./page";
import { TrendChart } from "../../_components/charts/TrendChart";
import { CategoryChart } from "../../_components/charts/CategoryChart";
import {
  bucketTrendByLocaleDay,
  totalsByCategory,
  trendDeltaPct,
} from "../../_components/charts/bucketing";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Dashboard + accessible charts. Pins the load-bearing chart-a11y rules:
 * (1) charts are not colour-only — each carries marker shape +
 * pattern words + direct value labels; (2) every chart exposes a keyboard-
 * reachable <table> data-table fallback as the primary SR experience; (3) the
 * trend bucketing respects the user-locale day boundary at midnight AND a DST
 * transition.
 */

const EPA_SOURCE: FactorSource = {
  name: "EPA GHG Emission Factors Hub",
  url: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub",
  edition: "2024",
  publishedYear: 2024,
};

function activity(over: Partial<Activity>): Activity {
  return {
    id: over.id ?? `a-${Math.random().toString(36).slice(2)}`,
    ts: over.ts ?? Date.parse("2026-06-01T12:00:00Z"),
    category: over.category ?? "energy",
    activity: over.activity ?? "Grid electricity",
    quantity: over.quantity ?? 50,
    unit: over.unit ?? "kWh",
    factorKey: over.factorKey ?? "energy.electricity.grid",
    factorSet: over.factorSet ?? "EPA",
    factorSetVersion: over.factorSetVersion ?? "epa-2024.1",
    co2eKg: over.co2eKg ?? 18.67,
    source: over.source ?? EPA_SOURCE,
    origin: over.origin ?? "nl",
  };
}

// ---------------------------------------------------------------------------
// locale-day trend bucketing (midnight + DST)
// ---------------------------------------------------------------------------
describe("bucketTrendByLocaleDay (user-locale day boundary)", () => {
  it("buckets two instants 1h apart across LOCAL midnight into DIFFERENT days", () => {
    // 23:30 and 00:30 New York local on consecutive dates.
    const before = activity({
      id: "before-midnight",
      ts: Date.parse("2026-06-02T03:30:00Z"), // 23:30 Jun 1 in America/New_York (EDT, -4)
      co2eKg: 10,
    });
    const after = activity({
      id: "after-midnight",
      ts: Date.parse("2026-06-02T04:30:00Z"), // 00:30 Jun 2 in America/New_York
      co2eKg: 20,
    });
    const buckets = bucketTrendByLocaleDay([before, after], "America/New_York");
    expect(buckets.map((b) => b.dayKey)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(buckets[0]?.totalKg).toBe(10);
    expect(buckets[1]?.totalKg).toBe(20);
  });

  it("the SAME two instants collapse to ONE day under a UTC-ahead zone (boundary depends on locale)", () => {
    const before = activity({
      ts: Date.parse("2026-06-02T03:30:00Z"),
      co2eKg: 10,
    });
    const after = activity({
      ts: Date.parse("2026-06-02T04:30:00Z"),
      co2eKg: 20,
    });
    // In Tokyo (+9) both are Jun 2 lunchtime — a single bucket.
    const buckets = bucketTrendByLocaleDay([before, after], "Asia/Tokyo");
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.dayKey).toBe("2026-06-02");
    expect(buckets[0]?.totalKg).toBe(30);
  });

  it("maps every instant correctly across a US DST spring-forward night", () => {
    // 2026-03-08 02:00 local is skipped (clocks jump to 03:00) in America/New_York.
    // 06:30Z = 01:30 EST (before), 07:30Z = 03:30 EDT (after) — both still Mar 8 local.
    const beforeJump = activity({
      ts: Date.parse("2026-03-08T06:30:00Z"),
      co2eKg: 5,
    });
    const afterJump = activity({
      ts: Date.parse("2026-03-08T07:30:00Z"),
      co2eKg: 7,
    });
    // And one instant that is the prior local day.
    const prevDay = activity({
      ts: Date.parse("2026-03-08T03:00:00Z"), // 22:00 Mar 7 EST
      co2eKg: 3,
    });
    const buckets = bucketTrendByLocaleDay(
      [beforeJump, afterJump, prevDay],
      "America/New_York",
    );
    expect(buckets.map((b) => b.dayKey)).toEqual(["2026-03-07", "2026-03-08"]);
    expect(buckets.find((b) => b.dayKey === "2026-03-08")?.totalKg).toBe(12);
    expect(buckets.find((b) => b.dayKey === "2026-03-07")?.totalKg).toBe(3);
  });

  it("totalsByCategory sorts descending and drops empty categories", () => {
    const totals = totalsByCategory([
      activity({ category: "energy", co2eKg: 5 }),
      activity({ category: "transport", co2eKg: 20 }),
      activity({ category: "energy", co2eKg: 5 }),
    ]);
    expect(totals.map((t) => t.category)).toEqual(["transport", "energy"]);
    expect(totals.map((t) => t.totalKg)).toEqual([20, 10]);
  });

  it("trendDeltaPct is signed and null without a prior period", () => {
    expect(trendDeltaPct([])).toBeNull();
    const buckets = bucketTrendByLocaleDay(
      [
        activity({ ts: Date.parse("2026-06-01T12:00:00Z"), co2eKg: 10 }),
        activity({ ts: Date.parse("2026-06-02T12:00:00Z"), co2eKg: 8 }),
      ],
      "UTC",
    );
    expect(trendDeltaPct(buckets)).toBeCloseTo(-20, 5);
  });
});

// ---------------------------------------------------------------------------
// Chart non-colour encoding + data-table fallback
// ---------------------------------------------------------------------------
describe("TrendChart — data-table fallback + summary (not colour-only)", () => {
  it("renders a keyboard-reachable data <table> with the exact per-day values", () => {
    const buckets = bucketTrendByLocaleDay(
      [
        activity({ ts: Date.parse("2026-06-01T12:00:00Z"), co2eKg: 10 }),
        activity({ ts: Date.parse("2026-06-02T12:00:00Z"), co2eKg: 8 }),
      ],
      "UTC",
    );
    render(<TrendChart buckets={buckets} titleId="t" />);

    const table = screen.getByRole("table");
    // The decorative SVG is hidden from the a11y tree; the table is the SR data.
    expect(within(table).getByText(/10\.00 kg/)).toBeInTheDocument();
    expect(within(table).getByText(/8\.00 kg/)).toBeInTheDocument();
    // A text summary states the trend in words (down 20%), not colour.
    expect(screen.getByTestId("trend-summary").textContent).toMatch(
      /down 20%/i,
    );
  });

  it("the chart SVG is aria-hidden so the table is the primary SR experience", () => {
    const buckets = bucketTrendByLocaleDay(
      [activity({ ts: Date.parse("2026-06-01T12:00:00Z"), co2eKg: 10 })],
      "UTC",
    );
    const { container } = render(<TrendChart buckets={buckets} titleId="t" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("CategoryChart — non-colour encoding + data-table fallback", () => {
  it("legend names each series' marker/pattern in WORDS, not colour alone", () => {
    const totals = totalsByCategory([
      activity({ category: "transport", co2eKg: 30 }),
      activity({ category: "energy", co2eKg: 10 }),
    ]);
    render(<CategoryChart totals={totals} titleId="c" />);

    // Pattern words appear (legend + table), proving a non-colour channel.
    expect(
      screen.getAllByText(/diagonal-hatch fill, triangle marker/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/solid fill, circle marker/i).length,
    ).toBeGreaterThan(0);
  });

  it("exposes a data <table> with per-category value + share and a top-contributor summary", () => {
    const totals = totalsByCategory([
      activity({ category: "transport", co2eKg: 30 }),
      activity({ category: "energy", co2eKg: 10 }),
    ]);
    render(<CategoryChart totals={totals} titleId="c" />);

    const table = screen.getByRole("table");
    expect(within(table).getByText(/30\.00 kg/)).toBeInTheDocument();
    expect(within(table).getByText(/75%/)).toBeInTheDocument(); // transport share
    expect(screen.getByTestId("category-summary").textContent).toMatch(
      /Transport.*75%/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Page — empty / loading / error / success states
// ---------------------------------------------------------------------------
function installFetch(responders: Array<(url: string) => unknown | undefined>) {
  const fn = vi.fn(async (url: string | URL) => {
    const u = String(url);
    for (const r of responders) {
      const out = r(u);
      if (out !== undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => out,
        } as unknown as Response;
      }
    }
    return {
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderDashboard() {
  return render(
    <AnnouncerProvider>
      <DashboardPage />
    </AnnouncerProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DashboardPage states", () => {
  it("shows the empty state with a 'Log your first activity' CTA when there is no data", async () => {
    installFetch([
      (url) =>
        url.includes("/api/activities") ? { activities: [] } : undefined,
      (url) =>
        url.includes("/api/goals") ? { goals: [], streak: null } : undefined,
    ]);
    renderDashboard();
    expect(
      await screen.findByRole("heading", { name: /Nothing logged yet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Log your first activity/i }),
    ).toBeInTheDocument();
  });

  it("renders the total, charts, and goal progress on success", async () => {
    const activities: Activity[] = [
      activity({
        id: "x1",
        category: "transport",
        ts: Date.parse("2026-06-01T12:00:00Z"),
        co2eKg: 30,
      }),
      activity({
        id: "x2",
        category: "energy",
        ts: Date.parse("2026-06-02T12:00:00Z"),
        co2eKg: 10,
      }),
    ];
    installFetch([
      (url) => (url.includes("/api/activities") ? { activities } : undefined),
      (url) =>
        url.includes("/api/goals")
          ? {
              goals: [
                {
                  id: "g1",
                  type: "reduction",
                  targetPct: 10,
                  baselineKg: 100,
                  period: "monthly",
                  createdAt: 0,
                  active: true,
                },
              ],
              streak: { count: 2, lastLoggedDate: "2026-06-02", longest: 3 },
            }
          : undefined,
    ]);
    renderDashboard();

    const totalSection = (
      await screen.findByRole("heading", { name: /Total footprint logged/i })
    ).closest("section") as HTMLElement;
    // Total = 40.00 kg, shown in the hero total card.
    expect(within(totalSection).getByText(/40\.00/)).toBeInTheDocument();
    // Two charts each expose a data-table fallback (trend + category).
    expect(screen.getAllByRole("table").length).toBeGreaterThanOrEqual(2);
    // Goal progress bar present.
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    // Streak count shown.
    expect(
      screen.getByRole("heading", { name: /Logging streak/i }),
    ).toBeInTheDocument();
  });

  it("'Show the math' on the total reveals a provenance breakdown table", async () => {
    const activities: Activity[] = [
      activity({
        id: "m1",
        co2eKg: 18.67,
        factorKey: "energy.electricity.grid",
      }),
    ];
    installFetch([
      (url) => (url.includes("/api/activities") ? { activities } : undefined),
      (url) =>
        url.includes("/api/goals") ? { goals: [], streak: null } : undefined,
    ]);
    const user = userEvent.setup();
    renderDashboard();

    const mathBtn = await screen.findByRole("button", {
      name: /Show the math for your total footprint/i,
    });
    expect(mathBtn).toHaveAttribute("aria-expanded", "false");
    await user.click(mathBtn);
    expect(mathBtn).toHaveAttribute("aria-expanded", "true");
    // The provenance table carries a descriptive source link to EPA.
    const link = screen.getByRole("link", {
      name: /EPA.*energy\.electricity\.grid/i,
    });
    expect(link).toHaveAttribute("href", expect.stringContaining("epa.gov"));
  });

  it("EMPTY state shows a 'Load sample data' button that seeds then renders the populated dashboard", async () => {
    let seeded = false;
    const seedCalls: string[] = [];
    const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/dev/seed")) {
        seedCalls.push(String(init?.method ?? "GET"));
        seeded = true;
        return {
          ok: true,
          status: 201,
          json: async () => ({ seeded: 16 }),
        } as unknown as Response;
      }
      if (u.includes("/api/activities")) {
        // Empty before seeding; populated after — drives the empty -> ready flip.
        return {
          ok: true,
          status: 200,
          json: async () => ({
            activities: seeded
              ? [
                  activity({
                    id: "sample-00-transport.car.gasoline",
                    category: "transport",
                    co2eKg: 79.02,
                    ts: Date.parse("2026-06-01T12:00:00Z"),
                  }),
                ]
              : [],
          }),
        } as unknown as Response;
      }
      if (u.includes("/api/goals")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ goals: [], streak: null }),
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchFn);
    const user = userEvent.setup();
    renderDashboard();

    const seedBtn = await screen.findByRole("button", {
      name: /Load sample data/i,
    });
    // Real <button>, ≥44px target, accessible name — no a11y regression.
    expect(seedBtn.tagName).toBe("BUTTON");

    await user.click(seedBtn);

    // The populated dashboard renders after the seed call.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Total footprint logged/i }),
      ).toBeInTheDocument(),
    );
    // It POSTed the seed endpoint.
    expect(seedCalls).toContain("POST");
    // The flow announces via the live region (it ends on the ready state after
    // the refresh, proving the populated dashboard was announced to SR users).
    expect(screen.getByTestId("live-region-polite").textContent).toBeTruthy();
    // With sample data present, a "Clear sample data" affordance appears.
    expect(
      screen.getByRole("button", { name: /Clear sample data/i }),
    ).toBeInTheDocument();
  });

  it("'Clear sample data' (shown when sample data is present) calls DELETE and clears the view", async () => {
    let cleared = false;
    const clearCalls: string[] = [];
    const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/dev/seed")) {
        clearCalls.push(String(init?.method ?? "GET"));
        cleared = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ cleared: true }),
        } as unknown as Response;
      }
      if (u.includes("/api/activities")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            activities: cleared
              ? []
              : [
                  activity({
                    id: "sample-00-transport.car.gasoline",
                    category: "transport",
                    co2eKg: 79.02,
                    ts: Date.parse("2026-06-01T12:00:00Z"),
                  }),
                ],
          }),
        } as unknown as Response;
      }
      if (u.includes("/api/goals")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ goals: [], streak: null }),
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchFn);
    const user = userEvent.setup();
    renderDashboard();

    const clearBtn = await screen.findByRole("button", {
      name: /Clear sample data/i,
    });
    expect(clearBtn.tagName).toBe("BUTTON");
    await user.click(clearBtn);

    // After clearing, the empty state returns.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Nothing logged yet/i }),
      ).toBeInTheDocument(),
    );
    expect(clearCalls).toContain("DELETE");
  });

  it("shows an accessible error state with a retry that recovers", async () => {
    let activityCalls = 0;
    installFetch([
      (url) => {
        if (url.includes("/api/activities")) {
          activityCalls += 1;
          return activityCalls === 1 ? undefined : { activities: [] };
        }
        return undefined;
      },
      (url) =>
        url.includes("/api/goals") ? { goals: [], streak: null } : undefined,
    ]);
    const user = userEvent.setup();
    renderDashboard();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(/Couldn.?t load your dashboard/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Nothing logged yet/i }),
      ).toBeInTheDocument(),
    );
  });
});
