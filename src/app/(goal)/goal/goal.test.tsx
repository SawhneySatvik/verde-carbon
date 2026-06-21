import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Goal } from "@core/schemas";
import GoalPage from "./page";
import { ConfirmDialog } from "./_components/ConfirmDialog";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Goal. Asserts: target + period save through POST
 * /api/goals; clearing a goal opens a FOCUS-TRAPPED confirm dialog that Esc
 * dismisses and that RETURNS focus to the opener on close; and inline validation
 * preserves input.
 */

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}
let calls: RecordedCall[];

const ACTIVE_GOAL: Goal = {
  id: "goal-1",
  type: "reduction",
  targetPct: 10,
  baselineKg: 100,
  period: "monthly",
  createdAt: 0,
  active: true,
};

function installFetch(opts: { goal: Goal | null }) {
  calls = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, method, body });
    if (method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          goals: opts.goal ? [opts.goal] : [],
          streak: { count: 3, lastLoggedDate: "2026-06-02", longest: 5 },
        }),
      } as unknown as Response;
    }
    // POST set/clear echoes a goal back.
    return {
      ok: true,
      status: 201,
      json: async () => ({ goal: { ...ACTIVE_GOAL, ...body } }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
}

function renderGoal() {
  return render(
    <AnnouncerProvider>
      <GoalPage />
    </AnnouncerProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GoalPage", () => {
  it("saves a target + period through POST /api/goals", async () => {
    installFetch({ goal: null });
    const user = userEvent.setup();
    renderGoal();

    const target = await screen.findByLabelText(/Reduction target/i);
    await user.clear(target);
    await user.type(target, "15");
    await user.click(screen.getByRole("radio", { name: /Yearly/i }));
    await user.click(screen.getByRole("button", { name: /Save goal/i }));

    await waitFor(() => {
      const posts = calls.filter((c) => c.method === "POST");
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toMatchObject({
        type: "reduction",
        targetPct: 15,
        period: "yearly",
        active: true,
      });
    });
  });

  it("validates an out-of-range target inline and preserves input", async () => {
    installFetch({ goal: null });
    const user = userEvent.setup();
    renderGoal();

    const target = await screen.findByLabelText(/Reduction target/i);
    await user.clear(target);
    await user.type(target, "250");

    await user.click(screen.getByRole("button", { name: /Save goal/i }));

    expect(screen.getByText(/between 1 and 100 percent/i)).toBeInTheDocument();
    expect(target).toHaveAttribute("aria-invalid", "true");
    expect(target).toHaveValue(250); // input preserved
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("clearing a goal opens a focus-trapped confirm dialog; Esc returns focus", async () => {
    installFetch({ goal: ACTIVE_GOAL });
    const user = userEvent.setup();
    renderGoal();

    const clearBtn = await screen.findByRole("button", { name: /Clear goal/i });
    clearBtn.focus();
    await user.click(clearBtn);

    const dialog = await screen.findByRole("dialog");
    // Dialog states what happens to the data.
    expect(
      within(dialog).getByText(
        /logged activities and footprint history are NOT affected/i,
      ),
    ).toBeInTheDocument();
    // Focus is inside the dialog (on the confirm button).
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    // Esc dismisses + returns focus to the opener.
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(document.activeElement).toBe(clearBtn);
    // No POST fired — clearing was cancelled.
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("confirming the dialog clears the goal via POST (active:false)", async () => {
    installFetch({ goal: ACTIVE_GOAL });
    const user = userEvent.setup();
    renderGoal();

    await user.click(
      await screen.findByRole("button", { name: /Clear goal/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /^Clear goal$/i }),
    );

    await waitFor(() => {
      const posts = calls.filter((c) => c.method === "POST");
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toMatchObject({ active: false });
    });
  });
});

describe("ConfirmDialog (focus trap)", () => {
  it("focuses the confirm button on open and keeps Tab within the dialog", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        title="Title"
        body="Body text"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Yes" });
    const cancel = within(dialog).getByRole("button", { name: "No" });
    expect(document.activeElement).toBe(confirm);

    // Tab from the last focusable wraps back to the first (trap).
    confirm.focus();
    await user.tab();
    expect([cancel, confirm]).toContain(document.activeElement);
  });
});
