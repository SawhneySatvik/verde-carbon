import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionProvider } from "./MotionProvider";
import { Banner } from "./Banner";

function renderBanner() {
  return render(
    <MotionProvider>
      <Banner />
    </MotionProvider>,
  );
}

/**
 * Banner — the a11y contract is unchanged from v1: a role="region"
 * with an accessible name, a real "Save my data" navigation link, and a real
 * dismiss <button> with an aria-label that hides the banner. The emoji/× glyphs
 * are now inline icons (aria-hidden) — the accessible names must be unaffected.
 */
describe("Banner", () => {
  it("is a labelled region announcing account status", () => {
    renderBanner();
    expect(
      screen.getByRole("region", { name: "Account status" }),
    ).toBeInTheDocument();
  });

  it("offers a real navigation link to the linking flow", () => {
    renderBanner();
    const link = screen.getByRole("link", { name: /Save my data/i });
    expect(link).toHaveAttribute("href", "/link");
  });

  it("dismiss is a real labelled button that removes the banner", async () => {
    const user = userEvent.setup();
    renderBanner();
    const dismiss = screen.getByRole("button", {
      name: /Dismiss account status message/i,
    });
    // ≥44px target preserved.
    expect(dismiss.className).toMatch(/min-h-\[44px\]/);
    await user.click(dismiss);
    expect(
      screen.queryByRole("region", { name: "Account status" }),
    ).not.toBeInTheDocument();
  });

  it("the lock + close glyphs are decorative (no stray accessible text)", () => {
    renderBanner();
    // The icons must not contribute an accessible name beyond the controls'.
    const region = screen.getByRole("region", { name: "Account status" });
    // No emoji leaked into the DOM text.
    expect(region.textContent).not.toMatch(/🔒|×/);
  });
});
