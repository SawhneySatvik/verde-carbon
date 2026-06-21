import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./page";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Settings. Asserts: factor-set and
 * unit toggles are labelled grouped controls; changing them ANNOUNCES the
 * recompute via the live region; and the provenance rule is stated in the UI —
 * switching factor set applies to NEW logs only and never recomputes historical
 * entries (so "click to source" stays truthful).
 */

function renderSettings() {
  return render(
    <AnnouncerProvider>
      <SettingsPage />
    </AnnouncerProvider>,
  );
}

describe("SettingsPage", () => {
  it("renders factor-set + unit toggles as labelled grouped controls", () => {
    renderSettings();
    expect(
      screen.getByRole("group", { name: /Emission factor set/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Units/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /EPA \(United States\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /DEFRA.*United Kingdom/i }),
    ).toBeInTheDocument();
  });

  it("states the rule: switching factor set applies to NEW logs only, no recompute", () => {
    renderSettings();
    const note = screen.getByText(/new logs only/i).closest("p") as HTMLElement;
    expect(note).toBeInTheDocument();
    expect(note.textContent).toMatch(/Switching the factor set/i);
    expect(note.textContent).toMatch(/not.*recomputed/i);
    expect(note.textContent).toMatch(/click to source/i);
  });

  it("announces the recompute when the factor set changes (provenance worded)", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(
      screen.getByRole("radio", { name: /DEFRA.*United Kingdom/i }),
    );
    const live = screen.getByTestId("live-region-assertive");
    expect(live.textContent).toMatch(/Factor set changed to DEFRA/i);
    expect(live.textContent).toMatch(/past entries keep their original/i);
  });

  it("announces an in-place, non-destructive conversion when units change", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("radio", { name: /^Metric/i }));
    const live = screen.getByTestId("live-region-assertive");
    expect(live.textContent).toMatch(/Units changed to metric/i);
    expect(live.textContent).toMatch(/converted in place/i);
  });
});
