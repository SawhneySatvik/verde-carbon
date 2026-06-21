import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoachPage from "./page";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Conversational Coach. Asserts the load-bearing
 * split: submitting a message POSTs /api/coach, the DIGIT-FREE `reply` is
 * appended as a coach turn, and the calculator `grounding` (total kg + top
 * category + top-3 insight titles, never AI-sourced) is rendered separately. Also
 * covers the `fallback:true` degrade path (shown as advice, not an error) and the
 * empty state (no activities → nudge to log).
 *
 * The page fires a priming POST on mount (to populate the grounding panel) and
 * then one POST per user turn; the fetch mock returns the same envelope shape for
 * both, so the panel is populated by the priming call and updated on each reply.
 */

const GROUNDING_WITH_DATA = {
  totalKg: 142.37,
  topCategory: "transport" as const,
  topInsightTitles: [
    "Swap a beef meal for a vegetarian one",
    "Swap a chicken meal for a vegetarian one",
  ],
  activityCount: 16,
};

const GROUNDING_EMPTY = {
  totalKg: 0,
  topCategory: null,
  topInsightTitles: [],
  activityCount: 0,
};

/** A digit-free coach reply (the route guarantees this). */
const DIGIT_FREE_REPLY =
  "Your transport is the heaviest slice, so a steady swap there will move the needle most. Try one car-free commute this week and let it compound.";

function installCoachFetch(
  reply: string,
  grounding: typeof GROUNDING_WITH_DATA | typeof GROUNDING_EMPTY,
  fallback = false,
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        reply,
        fallback,
        ...(fallback ? { reason: "ai_unavailable" } : {}),
        grounding,
      }),
    };
  }) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fn);
  return calls;
}

function renderCoach() {
  return render(
    <AnnouncerProvider>
      <CoachPage />
    </AnnouncerProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CoachPage", () => {
  it("submits a message → POSTs /api/coach → appends the digit-free reply and renders the calculator grounding", async () => {
    const calls = installCoachFetch(DIGIT_FREE_REPLY, GROUNDING_WITH_DATA);
    const user = userEvent.setup();
    renderCoach();

    // The grounding panel populates from the priming call.
    await screen.findByText(/Grounded in your data/i);
    await waitFor(() =>
      expect(screen.getByText(/142\.37/)).toBeInTheDocument(),
    );

    const input = screen.getByLabelText(/Ask the coach a question/i);
    await user.type(input, "What's my biggest lever?");
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    // The reply is appended as a coach turn.
    expect(await screen.findByText(DIGIT_FREE_REPLY)).toBeInTheDocument();

    // The message log is a real semantic list with the user + coach turns.
    const lists = screen.getAllByRole("list");
    const log = lists.find((l) => l.tagName === "OL");
    expect(log).toBeDefined();
    expect(
      within(log!).getByText(/What's my biggest lever\?/i),
    ).toBeInTheDocument();
    expect(within(log!).getByText(DIGIT_FREE_REPLY)).toBeInTheDocument();

    // The calculator grounding is rendered: total kg (tabular), top category, and
    // the top insight titles — none of which come from the AI reply. Scope the
    // category lookup to the grounding region (the prompt chip also says
    // "transport").
    const groundingRegion = screen.getByRole("complementary", {
      name: /Grounded in your data/i,
    });
    expect(screen.getByText(/142\.37/)).toBeInTheDocument();
    expect(within(groundingRegion).getByText(/Transport/i)).toBeInTheDocument();
    expect(
      within(groundingRegion).getByText(
        /Swap a beef meal for a vegetarian one/i,
      ),
    ).toBeInTheDocument();
    // It is made explicit these figures are computed, not AI-authored.
    expect(
      within(groundingRegion).getByText(
        /computed by the\s+calculator, not the AI/i,
      ),
    ).toBeInTheDocument();

    // POST /api/coach was called (priming + the user turn).
    const coachPosts = calls.filter(
      (c) => c.url === "/api/coach" && c.init?.method === "POST",
    );
    expect(coachPosts.length).toBeGreaterThanOrEqual(2);

    // The reply the user sees contains NO digit (the route's hard rule).
    expect(DIGIT_FREE_REPLY).not.toMatch(/\d/);
  });

  it("treats a fallback:true response as a normal (general-guidance) reply, not an error", async () => {
    installCoachFetch(DIGIT_FREE_REPLY, GROUNDING_WITH_DATA, true);
    const user = userEvent.setup();
    renderCoach();

    await screen.findByText(/Grounded in your data/i);

    const input = screen.getByLabelText(/Ask the coach a question/i);
    await user.type(input, "Where do I start?");
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    // The neutral reply is shown as advice...
    expect(await screen.findByText(DIGIT_FREE_REPLY)).toBeInTheDocument();
    // ...flagged as general guidance, NOT surfaced as an error. (The only
    // role="alert" in the tree is the always-present, empty assertive live region
    // from the AnnouncerProvider; our network-error copy is absent.)
    expect(screen.getByText(/General guidance/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/couldn't reach the coach/i),
    ).not.toBeInTheDocument();
  });

  it("shows an accessible network-error that preserves the typed message", async () => {
    // Priming succeeds; the user-turn POST then fails the network.
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            reply: DIGIT_FREE_REPLY,
            fallback: false,
            grounding: GROUNDING_WITH_DATA,
          }),
        };
      }
      throw new Error("network down");
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fn);

    const user = userEvent.setup();
    renderCoach();
    await screen.findByText(/Grounded in your data/i);

    const input = screen.getByLabelText(/Ask the coach a question/i);
    await user.type(input, "Help me out");
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    // An accessible, in-page error alert appears with retry-friendly copy. (The
    // matching set includes the AnnouncerProvider's sr-only assertive region; we
    // assert at least one match is the visible page-level error in a role=alert
    // that is NOT a live region.)
    await waitFor(() => {
      const matches = screen.getAllByText(/couldn't reach the coach/i);
      const pageError = matches.find(
        (el) =>
          el.closest('[role="alert"]') !== null &&
          el.closest("[data-testid]") === null,
      );
      expect(pageError).toBeDefined();
    });
    // ...and the user's message is restored to the composer (never lost).
    await waitFor(() =>
      expect(screen.getByLabelText(/Ask the coach a question/i)).toHaveValue(
        "Help me out",
      ),
    );
  });

  it("renders the empty state when the user has no activities to coach on", async () => {
    installCoachFetch(DIGIT_FREE_REPLY, GROUNDING_EMPTY);
    renderCoach();

    expect(
      await screen.findByRole("heading", {
        name: /Log an activity to coach on/i,
      }),
    ).toBeInTheDocument();
    // The empty grounding panel states there's nothing to ground figures in.
    expect(
      screen.getByText(/nothing to ground the figures in/i),
    ).toBeInTheDocument();
  });

  it("keeps the composer focusable and restores its focus across a send cycle (WCAG 2.4.3)", async () => {
    // A delayed reply lets us inspect the in-flight ("thinking") state before
    // the round-trip resolves.
    let resolveReply: (() => void) | undefined;
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount += 1;
      const envelope = {
        ok: true,
        status: 200,
        json: async () => ({
          reply: DIGIT_FREE_REPLY,
          fallback: false,
          grounding: GROUNDING_WITH_DATA,
        }),
      };
      // Priming call (first) resolves immediately; the user-turn call is gated.
      if (callCount === 1) {
        return envelope;
      }
      await new Promise<void>((resolve) => {
        resolveReply = resolve;
      });
      return envelope;
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fn);

    const user = userEvent.setup();
    renderCoach();
    await screen.findByText(/Grounded in your data/i);

    const input = screen.getByLabelText(
      /Ask the coach a question/i,
    ) as HTMLTextAreaElement;
    await user.type(input, "What's my biggest lever?");
    // The composer is focused while typing.
    expect(input).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    // In flight: the textarea must NOT be disabled (a disabled element can't hold
    // focus, dropping keyboard/SR users to <body>). It is read-only + busy.
    await waitFor(() => expect(input).toHaveAttribute("aria-busy", "true"));
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute("readonly");

    // Resolve the reply; the composer regains focus once the reply lands.
    resolveReply?.();
    expect(await screen.findByText(DIGIT_FREE_REPLY)).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveFocus());
    // ...and is interactive again (not read-only) for the next turn.
    expect(input).not.toHaveAttribute("readonly");
    expect(input).not.toBeDisabled();
  });

  it("restores composer focus after sending via a suggested-prompt chip (which disables mid-click)", async () => {
    installCoachFetch(DIGIT_FREE_REPLY, GROUNDING_WITH_DATA);
    const user = userEvent.setup();
    renderCoach();
    await screen.findByText(/Grounded in your data/i);

    const chip = screen.getByRole("button", {
      name: /How do I cut transport\?/i,
    });
    await user.click(chip);

    // The chip is disabled mid-send (dropping its own focus), so once the reply
    // lands focus is pulled back to the composer rather than left on <body>.
    expect(await screen.findByText(DIGIT_FREE_REPLY)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/Ask the coach a question/i)).toHaveFocus(),
    );
  });

  it("offers suggested-prompt chips as real buttons that send on click", async () => {
    const calls = installCoachFetch(DIGIT_FREE_REPLY, GROUNDING_WITH_DATA);
    const user = userEvent.setup();
    renderCoach();

    await screen.findByText(/Grounded in your data/i);

    const chip = screen.getByRole("button", {
      name: /How do I cut transport\?/i,
    });
    expect(chip.tagName).toBe("BUTTON");
    await user.click(chip);

    // The prompt is sent as a user turn and the reply appended.
    expect(await screen.findByText(DIGIT_FREE_REPLY)).toBeInTheDocument();
    const coachPosts = calls.filter(
      (c) => c.url === "/api/coach" && c.init?.method === "POST",
    );
    expect(coachPosts.length).toBeGreaterThanOrEqual(2);
  });
});
