import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { previewActivities } from "@core/calculator/preview";
import { BreakdownTable } from "./BreakdownTable";

/**
 * Shared BreakdownTable: a real accessible <table> with caption + scoped
 * headers, calculator-sourced numbers, descriptive source links, and an
 * unsourced row that is marked with icon + text (not color alone) and EXCLUDED
 * from the total (partial-state + chart/table a11y rules).
 */
describe("BreakdownTable", () => {
  it("renders sourced rows with calculator numbers and a descriptive source link", () => {
    const result = previewActivities(
      [
        {
          activity: "Beef meals",
          candidateFactorKey: "diet.meal.beef",
          value: 4,
          unit: "meal",
        },
      ],
      { locale: "US" },
    );
    render(<BreakdownTable result={result} />);

    const table = screen.getByRole("table");
    // 4 × 6.61 = 26.44 kg, from the calculator (row + total).
    expect(within(table).getAllByText(/26\.44 kg/).length).toBeGreaterThan(0);
    const link = within(table).getByRole("link", { name: /diet\.meal\.beef/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https?:/));
  });

  it("marks an unsourced item with text + excludes it from the total", () => {
    const result = previewActivities(
      [
        {
          activity: "Electricity",
          candidateFactorKey: "energy.electricity.grid",
          value: 100,
          unit: "kWh",
        },
        {
          activity: "Mystery item",
          candidateFactorKey: "does.not.exist",
          value: 5,
          unit: "kg",
        },
      ],
      { locale: "US" },
    );
    expect(result.hasUnsourced).toBe(true);

    render(<BreakdownTable result={result} />);
    expect(screen.getByText(/can.?t source this yet/i)).toBeInTheDocument();
    // Total reflects ONLY the sourced electricity row (37.34 kg), not a guess.
    expect(screen.getByText(/sourced items only/i)).toBeInTheDocument();
    expect(screen.getAllByText(/37\.34 kg/).length).toBeGreaterThan(0);
  });
});
