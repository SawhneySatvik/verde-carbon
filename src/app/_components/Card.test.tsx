import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

/**
 * Card — the Double-Bezel material. Tests guard the structural
 * contract: an outer shell wrapping a concentric inner core, and that the card is
 * a transparent presentational wrapper (forwards role/aria/id, renders chosen
 * element) so it never weakens the semantics of whatever it contains.
 */
describe("Card (Double-Bezel)", () => {
  it("renders an outer shell wrapping an inner core (two nested elements)", () => {
    render(<Card data-testid="card">Inside</Card>);
    const shell = screen.getByTestId("card");
    // Outer shell carries the 24px radius + hairline ring; the single child is
    // the concentric inner core that actually holds content.
    expect(shell.className).toContain("rounded-2xl");
    expect(shell.className).toContain("ring-1");
    expect(shell.children).toHaveLength(1);
    const core = shell.firstElementChild as HTMLElement;
    expect(core.className).toContain("rounded-bezel-inner");
    expect(core).toHaveTextContent("Inside");
  });

  it("forwards role + aria + id to the outer element (semantics preserved)", () => {
    render(
      <Card as="section" role="group" aria-label="Footprint summary" id="fp">
        body
      </Card>,
    );
    const region = screen.getByRole("group", { name: "Footprint summary" });
    expect(region.tagName).toBe("SECTION");
    expect(region).toHaveAttribute("id", "fp");
  });

  it("uses the floating shadow + raised surface when elevation=raised", () => {
    render(
      <Card data-testid="float" elevation="raised">
        x
      </Card>,
    );
    const shell = screen.getByTestId("float");
    expect(shell.className).toContain("shadow-float");
    expect((shell.firstElementChild as HTMLElement).className).toContain(
      "bg-surface-raised",
    );
  });
});
