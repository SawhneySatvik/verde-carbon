import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionProvider } from "./MotionProvider";
import { Badge, Chip } from "./Badge";

function renderWithMotion(ui: React.ReactElement) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}

describe("Badge", () => {
  it("renders its label text so meaning is never color-only", () => {
    render(<Badge tone="success">Reduced</Badge>);
    expect(screen.getByText("Reduced")).toBeInTheDocument();
  });

  it("keeps a leading icon decorative (aria-hidden)", () => {
    render(
      <Badge tone="info" icon={<svg data-testid="ic" />}>
        Info
      </Badge>,
    );
    const icon = screen.getByTestId("ic");
    expect(icon.parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Chip", () => {
  it("is a real button with aria-pressed reflecting selection", () => {
    const { rerender } = renderWithMotion(<Chip selected={false}>Diet</Chip>);
    const chip = screen.getByRole("button", { name: "Diet" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    rerender(
      <MotionProvider>
        <Chip selected>Diet</Chip>
      </MotionProvider>,
    );
    expect(screen.getByRole("button", { name: "Diet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("omits aria-pressed when not a toggle (selected undefined)", () => {
    renderWithMotion(<Chip>Filter</Chip>);
    expect(screen.getByRole("button", { name: "Filter" })).not.toHaveAttribute(
      "aria-pressed",
    );
  });

  it("fires onClick and has a ≥44px target + focus ring", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithMotion(<Chip onClick={onClick}>Energy</Chip>);
    const chip = screen.getByRole("button", { name: "Energy" });
    expect(chip.className).toMatch(/min-h-\[44px\]/);
    expect(chip.className).toContain("focus-visible:ring-2");
    await user.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled chip does not fire onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithMotion(
      <Chip disabled onClick={onClick}>
        Off
      </Chip>,
    );
    await user.click(screen.getByRole("button", { name: "Off" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
