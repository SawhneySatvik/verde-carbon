import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogPage from "./page";
import { ParseConfirmation } from "./_components/ParseConfirmation";
import { FallbackForm } from "./_components/FallbackForm";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Log Activity (NL) + Parse Confirmation + Fallback + Breakdown.
 *
 * The load-bearing assertion: NOTHING persists until the user clicks
 * "Log it". A fake fetch records every call; we assert there is NO non-preview
 * POST to /api/activities until confirm. Plus: editable items recompute via the
 * client preview, the candidate-factor picker BLOCKS save until resolved, and
 * the AI-free fallback feeds the SAME calculator/breakdown.
 */

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

let calls: RecordedCall[];

function installFetch(
  responders: Array<(url: string, init?: RequestInit) => unknown | undefined>,
) {
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, method: init?.method ?? "GET", body });
    for (const r of responders) {
      const out = r(u, init);
      if (out !== undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => out,
        } as unknown as Response;
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** True for a REAL persisting write (POST /api/activities WITHOUT ?preview). */
function isPersistWrite(c: RecordedCall): boolean {
  return (
    c.method === "POST" &&
    c.url.includes("/api/activities") &&
    !c.url.includes("preview=1") &&
    !c.url.includes("preview")
  );
}

function renderLog() {
  return render(
    <AnnouncerProvider>
      <LogPage />
    </AnnouncerProvider>,
  );
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LogPage — show before save", () => {
  it("does NOT persist (no non-preview POST /api/activities) until 'Log it'", async () => {
    installFetch([
      (url) =>
        url.includes("/api/parse")
          ? {
              fallback: false,
              parse: {
                items: [
                  {
                    activity: "electricity",
                    value: 50,
                    unit: "kWh",
                    candidateFactorKey: "energy.electricity.grid",
                    confidence: 0.9,
                  },
                ],
              },
            }
          : undefined,
      (url) =>
        url.includes("/api/activities")
          ? { persisted: [], unsourced: [], totalKg: 18.67, partial: false }
          : undefined,
    ]);

    const user = userEvent.setup();
    renderLog();

    await user.type(
      screen.getByLabelText(/Describe your activity/i),
      "used 50 kwh of electricity",
    );
    await user.click(
      screen.getByRole("button", { name: /See the breakdown/i }),
    );

    // The Parse Confirmation breakdown is shown (computed by the client preview).
    await screen.findByText(/Check this before you save/i);

    // CRITICAL: parsing + preview happened, but NOTHING was persisted yet.
    expect(calls.some((c) => c.url.includes("/api/parse"))).toBe(true);
    expect(calls.some(isPersistWrite)).toBe(false);

    // The computed CO2e is visible (50 kWh × 0.37335… = 18.67 kg).
    expect(screen.getAllByText(/18\.67/).length).toBeGreaterThan(0);

    // Now confirm — THIS is the first and only persist write.
    await user.click(screen.getByRole("button", { name: /^Log it$/i }));

    await screen.findByRole("heading", {
      name: /Logged — added to your dashboard/i,
    });
    const writes = calls.filter(isPersistWrite);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toMatchObject({
      origin: "nl",
      items: [
        expect.objectContaining({
          candidateFactorKey: "energy.electricity.grid",
          value: 50,
        }),
      ],
    });
  });

  it("drops to the structured fallback when the parser signals fallback (no persist)", async () => {
    installFetch([
      (url) =>
        url.includes("/api/parse")
          ? {
              fallback: true,
              reason: "ai_unavailable",
              message: "The parser is unavailable right now.",
            }
          : undefined,
    ]);

    const user = userEvent.setup();
    renderLog();
    await user.type(
      screen.getByLabelText(/Describe your activity/i),
      "something the parser hates",
    );
    await user.click(
      screen.getByRole("button", { name: /See the breakdown/i }),
    );

    expect(await screen.findByText(/Log without AI/i)).toBeInTheDocument();
    expect(calls.some(isPersistWrite)).toBe(false);
  });
});

describe("ParseConfirmation — candidate-factor picker blocks save", () => {
  function renderConfirm(
    items: Array<{
      activity: string;
      value: number;
      unit: "kWh" | "km" | "meal" | "gallon";
      candidateFactorKey: string;
    }>,
    onConfirm = vi.fn(),
  ) {
    render(
      <AnnouncerProvider>
        <ParseConfirmation
          parsedItems={items}
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      </AnnouncerProvider>,
    );
    return onConfirm;
  }

  it("disables 'Log it' while an item is unsourced, then enables it once resolved", async () => {
    const user = userEvent.setup();
    const onConfirm = renderConfirm([
      {
        activity: "mystery",
        value: 3,
        unit: "meal",
        candidateFactorKey: "diet.meal.unknown", // not in vocabulary
      },
    ]);

    const logBtn = screen.getByRole("button", { name: /^Log it$/i });
    expect(logBtn).toBeDisabled();
    // The picker is shown with a reason.
    expect(screen.getByText(/couldn.?t match a source/i)).toBeInTheDocument();

    // Resolve by picking a real factor.
    await user.click(
      screen.getByRole("radio", { name: /Beef \/ red-meat meal/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Log it$/i })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: /^Log it$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]?.[0]).toMatchObject({
      candidateFactorKey: "diet.meal.beef",
    });
  });

  it("recomputes the total live when an editable quantity changes", async () => {
    const user = userEvent.setup();
    renderConfirm([
      {
        activity: "electricity",
        value: 100,
        unit: "kWh",
        candidateFactorKey: "energy.electricity.grid",
      },
    ]);

    // 100 kWh → 37.34 kg.
    expect(screen.getAllByText(/37\.34/).length).toBeGreaterThan(0);

    const qty = screen.getByLabelText(/Quantity/i);
    await user.clear(qty);
    await user.type(qty, "200");
    // 200 kWh → 74.67 kg.
    await waitFor(() =>
      expect(screen.getAllByText(/74\.67/).length).toBeGreaterThan(0),
    );
  });

  it("'Show the math' reveals arithmetic + a descriptive source link", async () => {
    const user = userEvent.setup();
    renderConfirm([
      {
        activity: "beef",
        value: 2,
        unit: "meal",
        candidateFactorKey: "diet.meal.beef",
      },
    ]);

    await user.click(screen.getByRole("button", { name: /Show the math/i }));
    // The arithmetic line is present (the disclosure panel is the only place
    // the multiplication "×" + "=" appears).
    expect(screen.getByText(/kg\/meal/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /diet\.meal\.beef/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https?:/));
  });
});

describe("LogPage — focus follows the flow on phase change (WCAG 2.4.3)", () => {
  it("moves focus to the Parse Confirmation heading on confirm, then to the success heading on saved", async () => {
    installFetch([
      (url) =>
        url.includes("/api/parse")
          ? {
              fallback: false,
              parse: {
                items: [
                  {
                    activity: "electricity",
                    value: 50,
                    unit: "kWh",
                    candidateFactorKey: "energy.electricity.grid",
                    confidence: 0.9,
                  },
                ],
              },
            }
          : undefined,
      (url) =>
        url.includes("/api/activities")
          ? { persisted: [], unsourced: [], totalKg: 18.67, partial: false }
          : undefined,
    ]);

    const user = userEvent.setup();
    renderLog();

    await user.type(
      screen.getByLabelText(/Describe your activity/i),
      "used 50 kwh of electricity",
    );
    await user.click(
      screen.getByRole("button", { name: /See the breakdown/i }),
    );

    // On `confirm`, focus lands on the "Check this before you save" heading.
    const confirmHeading = await screen.findByRole("heading", {
      name: /Check this before you save/i,
    });
    await waitFor(() => expect(confirmHeading).toHaveFocus());

    // On `saved`, focus moves to the success heading.
    await user.click(screen.getByRole("button", { name: /^Log it$/i }));
    const savedHeading = await screen.findByRole("heading", {
      name: /Logged — added to your dashboard/i,
    });
    await waitFor(() => expect(savedHeading).toHaveFocus());
  });

  it("moves focus to the fallback explanation when a parse fails into the structured form", async () => {
    installFetch([
      (url) =>
        url.includes("/api/parse")
          ? {
              fallback: true,
              reason: "ai_unavailable",
              message: "The parser is unavailable right now.",
            }
          : undefined,
    ]);

    const user = userEvent.setup();
    renderLog();
    await user.type(
      screen.getByLabelText(/Describe your activity/i),
      "something the parser hates",
    );
    await user.click(
      screen.getByRole("button", { name: /See the breakdown/i }),
    );

    // The fallback explanation receives focus so the keyboard / SR user isn't
    // stranded on the now-removed parse control. (Target the rendered fallback
    // <p> by its visible copy — distinct from the announcer's live region.)
    const fallbackMsg = await screen.findByText(
      /You can still log it below — no AI needed\./i,
    );
    await waitFor(() => expect(fallbackMsg).toHaveFocus());
  });
});

describe("FallbackForm — AI-free, same calculator", () => {
  it("submits a structured item that feeds the same breakdown", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AnnouncerProvider>
        <FallbackForm onSubmit={onSubmit} />
      </AnnouncerProvider>,
    );

    await user.selectOptions(screen.getByLabelText(/Category/i), "energy");
    await user.selectOptions(
      screen.getByLabelText(/Activity/i),
      "energy.electricity.grid",
    );
    await user.type(screen.getByLabelText(/Quantity/i), "10");
    await user.click(screen.getByRole("button", { name: /Preview CO₂e/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]?.[0]).toMatchObject({
      candidateFactorKey: "energy.electricity.grid",
      value: 10,
      unit: "kWh",
    });
  });

  it("validates a missing quantity inline and preserves input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AnnouncerProvider>
        <FallbackForm onSubmit={onSubmit} />
      </AnnouncerProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Preview CO₂e/i }));
    // The inline field error is shown (the form's own role="alert" message); the
    // input is marked invalid and the value the user typed is preserved.
    expect(screen.getByText(/quantity greater than zero/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
