import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionProvider } from "./MotionProvider";
import { Tabs, type TabItem } from "./Tabs";

const ITEMS: ReadonlyArray<TabItem> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function renderTabs(extra?: Partial<TabItem>[]) {
  const items = extra
    ? ITEMS.map((it, i) => ({ ...it, ...(extra[i] ?? {}) }))
    : ITEMS;
  return render(
    <MotionProvider>
      <Tabs label="Trend range" items={items}>
        {(active) => <p>Panel: {active}</p>}
      </Tabs>
    </MotionProvider>,
  );
}

/**
 * Tabs — full WAI-ARIA Tabs pattern. Tests assert the role structure, the
 * aria-controls/aria-labelledby wiring, roving tabindex, automatic activation on
 * arrow/Home/End, wrap-around, and that disabled tabs are skipped — the a11y
 * floor for this primitive.
 */
describe("Tabs (WAI-ARIA Tabs pattern)", () => {
  it("exposes a named tablist with one selected tab and a labelled panel", () => {
    renderTabs();
    const tablist = screen.getByRole("tablist", { name: "Trend range" });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");

    // Active tab controls a panel that is labelled back by the tab.
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Panel: week");
    expect(tabs[0]).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0].id);
  });

  it("uses a roving tabindex (only the active tab is in the Tab order)", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[2]).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight/ArrowLeft move focus AND activate, wrapping at the ends", async () => {
    const user = userEvent.setup();
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();

    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel: month");

    // Wrap forward: year → week.
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    // Wrap backward: week → year.
    await user.keyboard("{ArrowLeft}");
    expect(tabs[2]).toHaveFocus();
  });

  it("Home/End jump to the first/last enabled tab", async () => {
    const user = userEvent.setup();
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();

    await user.keyboard("{End}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
  });

  it("skips disabled tabs during arrow navigation", async () => {
    const user = userEvent.setup();
    renderTabs([{}, { disabled: true }, {}]);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1]).toBeDisabled();

    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    // month is disabled → focus lands on year.
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("clicking a tab activates it and swaps the visible panel", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Year" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel: year");
  });
});
