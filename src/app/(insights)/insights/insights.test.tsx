import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InsightsPage from "./page";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Insights. Asserts: the list is a real semantic <ol>;
 * the RANK is stated IN TEXT ("#1 highest impact"), not by position/colour alone;
 * each saving is the calculator-sourced number from GET /api/insights with its
 * factor source; and empty / error states render.
 */

const SOURCE = {
  name: "EPA GHG Emission Factors Hub",
  url: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub",
  edition: "2024",
  publishedYear: 2024,
};

function insight(rank: number, savedDisplay: number) {
  return {
    id: `swap-${rank}`,
    title: `Swap action ${rank}`,
    rank,
    projectedKgSaved: savedDisplay,
    projectedKgSavedDisplay: savedDisplay,
    currentBasis: {
      candidateFactorKey: "diet.meal.beef",
      factorValue: 6,
      factorSet: "EPA" as const,
      factorSetVersion: "epa-2024.1",
      source: SOURCE,
      co2eKg: 6,
    },
    alternativeBasis: {
      candidateFactorKey: "diet.meal.vegetarian",
      factorValue: 1.5,
      factorSet: "EPA" as const,
      factorSetVersion: "epa-2024.1",
      source: SOURCE,
      co2eKg: 1.5,
    },
    phrase: `Swap action ${rank} could save about ${savedDisplay} kg CO2e.`,
  };
}

function installFetch(payload: unknown, ok = true) {
  const fn = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fn);
}

function renderInsights() {
  return render(
    <AnnouncerProvider>
      <InsightsPage />
    </AnnouncerProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("InsightsPage", () => {
  it("renders ranked insights as a semantic list with the rank stated IN TEXT", async () => {
    installFetch({
      insights: [insight(1, 4.5), insight(2, 2.25)],
      skipped: [],
    });
    renderInsights();

    await screen.findByText(/#1 highest impact/i);
    const lists = screen.getAllByRole("list");
    const ol = lists.find((l) => l.tagName === "OL");
    expect(ol).toBeDefined();
    const items = within(ol!).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // Rank is text, not position/colour alone.
    expect(
      within(items[0]!).getByText(/#1 highest impact/i),
    ).toBeInTheDocument();
    expect(
      within(items[1]!).getByText(/#2 highest impact/i),
    ).toBeInTheDocument();
  });

  it("shows each insight's calculator-sourced saving with a factor source link", async () => {
    installFetch({ insights: [insight(1, 4.5)], skipped: [] });
    renderInsights();

    expect(await screen.findByText(/−4\.50 kg CO₂e/)).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /EPA.*diet\.meal\.beef/i,
    });
    expect(link).toHaveAttribute("href", expect.stringContaining("epa.gov"));
  });

  it("renders the empty state when there is too little data to personalise", async () => {
    installFetch({ insights: [], skipped: [] });
    renderInsights();
    expect(
      await screen.findByRole("heading", {
        name: /Log a few more activities/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders an accessible error state with a retry", async () => {
    installFetch({}, false);
    const user = userEvent.setup();
    renderInsights();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Retry now succeeds.
    installFetch({ insights: [insight(1, 1.0)], skipped: [] });
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    expect(await screen.findByText(/#1 highest impact/i)).toBeInTheDocument();
  });
});
