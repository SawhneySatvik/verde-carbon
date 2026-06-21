import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionProvider } from "./MotionProvider";
import { Button } from "./Button";
import { ArrowUpRight } from "./icons";

function renderWithMotion(ui: React.ReactElement) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}

/**
 * Button — primary/secondary/ghost with the full state matrix. Tests assert the
 * a11y floor: a real <button>, keyboard activation, focus-visible ring class,
 * loading sets aria-busy + disables WITHOUT removing the accessible name, and the
 * trailing CTA icon (button-in-button) stays aria-hidden / decorative.
 */
describe("Button", () => {
  it("renders a real <button> and fires onClick on click and Enter/Space", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithMotion(<Button onClick={onClick}>Save goal</Button>);
    const btn = screen.getByRole("button", { name: "Save goal" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");

    await user.click(btn);
    btn.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("carries a visible focus-visible ring in every variant", () => {
    const { rerender } = renderWithMotion(<Button>P</Button>);
    expect(screen.getByRole("button").className).toContain(
      "focus-visible:ring-2",
    );
    rerender(
      <MotionProvider>
        <Button variant="secondary">S</Button>
      </MotionProvider>,
    );
    expect(screen.getByRole("button").className).toContain(
      "focus-visible:ring-ring",
    );
    rerender(
      <MotionProvider>
        <Button variant="ghost">G</Button>
      </MotionProvider>,
    );
    expect(screen.getByRole("button").className).toContain(
      "focus-visible:ring-offset-2",
    );
  });

  it("loading sets aria-busy, disables, but keeps the accessible name", () => {
    renderWithMotion(<Button loading>Logging…</Button>);
    const btn = screen.getByRole("button", { name: /logging/i });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
  });

  it("disabled does not fire onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithMotion(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Off" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("button-in-button trailing icon is decorative (aria-hidden), name unchanged", () => {
    renderWithMotion(
      <Button trailingIcon={<ArrowUpRight />}>See the breakdown</Button>,
    );
    // The accessible name must be the text only — the icon must not leak in.
    const btn = screen.getByRole("button", { name: "See the breakdown" });
    // The icon SVG sits inside an aria-hidden island wrapper.
    const hidden = btn.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  it("meets the ≥44px target floor (min-h class on both sizes)", () => {
    const { rerender } = renderWithMotion(<Button size="sm">sm</Button>);
    expect(screen.getByRole("button").className).toMatch(/min-h-\[44px\]/);
    rerender(
      <MotionProvider>
        <Button size="md">md</Button>
      </MotionProvider>,
    );
    expect(screen.getByRole("button").className).toMatch(/min-h-\[48px\]/);
  });
});
