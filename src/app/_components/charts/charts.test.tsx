import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TrendChart } from "./TrendChart";
import { CategoryChart } from "./CategoryChart";
import { bucketTrendByLocaleDay, totalsByCategory } from "./bucketing";
import type { Activity } from "@core/schemas";

/**
 * Chart/table guard. The visual uplift (gradient area fill,
 * gridlines, draw-in, haloed markers) is purely DECORATIVE and lives inside the
 * `aria-hidden` SVG; these tests pin that the NON-COLOUR encoding, the keyboard-
 * reachable data-table fallback, and the text summary survive.
 */

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
    source: over.source ?? {
      name: "EPA GHG Emission Factors Hub",
      url: "https://www.epa.gov/",
      edition: "2024",
      publishedYear: 2024,
    },
    origin: over.origin ?? "nl",
  };
}

describe("TrendChart keeps the a11y contract", () => {
  const buckets = bucketTrendByLocaleDay(
    [
      activity({ ts: Date.parse("2026-06-01T12:00:00Z"), co2eKg: 10 }),
      activity({ ts: Date.parse("2026-06-02T12:00:00Z"), co2eKg: 8 }),
    ],
    "UTC",
  );

  it("renders the decorative SVG aria-hidden + presentation (table is primary)", () => {
    const { container } = render(<TrendChart buckets={buckets} titleId="t" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("role", "presentation");
  });

  it("still plots circle markers + direct numeric value labels in the SVG", () => {
    const { container } = render(<TrendChart buckets={buckets} titleId="t" />);
    expect(container.querySelectorAll("svg circle").length).toBeGreaterThan(0);
    // direct per-point value labels (text, not colour) survive.
    expect(container.querySelectorAll("svg text").length).toBeGreaterThan(0);
  });

  it("the gradient area fill is decorative SVG only — the table carries the data", () => {
    const { container } = render(<TrendChart buckets={buckets} titleId="t" />);
    // A gradient <def> exists, but it lives inside the aria-hidden SVG.
    const grad = container.querySelector("linearGradient#t-area");
    expect(grad).not.toBeNull();
    expect(grad?.closest("svg")).toHaveAttribute("aria-hidden", "true");

    const table = screen.getByRole("table");
    expect(within(table).getByText(/10\.00 kg/)).toBeInTheDocument();
    expect(within(table).getByText(/8\.00 kg/)).toBeInTheDocument();
  });

  it("keeps the text summary in a status region", () => {
    render(<TrendChart buckets={buckets} titleId="t" />);
    expect(screen.getByTestId("trend-summary").textContent).toMatch(
      /down 20%/i,
    );
  });
});

describe("CategoryChart keeps non-colour encoding", () => {
  const totals = totalsByCategory([
    activity({ category: "transport", co2eKg: 30 }),
    activity({ category: "energy", co2eKg: 10 }),
  ]);

  it("legend + table still name each series' pattern/marker in WORDS", () => {
    render(<CategoryChart totals={totals} titleId="c" />);
    expect(
      screen.getAllByText(/diagonal-hatch fill, triangle marker/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/solid fill, circle marker/i).length,
    ).toBeGreaterThan(0);
  });

  it("bars are SVG <pattern>-filled (geometry), not flat colour", () => {
    const { container } = render(<CategoryChart totals={totals} titleId="c" />);
    const patternedBars = container.querySelectorAll(
      "rect[fill^='url(#viz-pat-']",
    );
    expect(patternedBars.length).toBeGreaterThan(0);
    expect(container.querySelector("pattern#viz-pat-transport")).not.toBeNull();
  });

  it("exposes a data table with a visible caption + per-category figures", () => {
    render(<CategoryChart totals={totals} titleId="c" />);
    const table = screen.getByRole("table", { name: /Footprint by category/i });
    expect(within(table).getByText(/30\.00 kg/)).toBeInTheDocument();
    expect(within(table).getByText(/75%/)).toBeInTheDocument();
  });
});
