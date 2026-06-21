import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LinkPage from "./page";
import { AnnouncerProvider } from "../../_components/Announcer";

/**
 * Account-linking. Asserts: WCAG 3.3.8 Accessible
 * Authentication (standard provider sign-in, no cognitive test); a "what carries
 * over" explainer; and the keep-vs-merge resolver wired to POST /api/account/link
 * — the 409 conflict surfaces a choice that states what happens to each set, and
 * merge/keep post the right resolution.
 */

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}
let calls: RecordedCall[];

function installFetch(
  responder: (call: RecordedCall) => {
    ok: boolean;
    status: number;
    body: unknown;
  },
) {
  calls = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const call: RecordedCall = {
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const out = responder(call);
    return {
      ok: out.ok,
      status: out.status,
      json: async () => out.body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
}

function renderLink() {
  return render(
    <AnnouncerProvider>
      <LinkPage />
    </AnnouncerProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LinkPage", () => {
  it("shows the 'what carries over' explainer and standard auth (no cognitive test)", () => {
    installFetch(() => ({ ok: true, status: 200, body: {} }));
    renderLink();
    expect(
      screen.getByRole("heading", { name: /What carries over/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Every activity you/i)).toBeInTheDocument();
    // Standard provider sign-in (no puzzle/CAPTCHA).
    expect(
      screen.getByRole("radio", { name: /Continue with Google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Email & password/i }),
    ).toBeInTheDocument();
  });

  it("password fields use standard autocomplete (manager-fillable, no CAPTCHA)", async () => {
    installFetch(() => ({ ok: true, status: 200, body: {} }));
    const user = userEvent.setup();
    renderLink();
    await user.click(screen.getByRole("radio", { name: /Email & password/i }));
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText(/^Password$/i)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("links on the happy path (uid-preserving) and confirms saved & synced", async () => {
    installFetch((call) =>
      call.method === "POST"
        ? { ok: true, status: 200, body: { status: "linked", uid: "anon-1" } }
        : { ok: true, status: 200, body: {} },
    );
    const user = userEvent.setup();
    renderLink();

    await user.click(screen.getByRole("button", { name: /Save my data/i }));
    expect(
      await screen.findByRole("heading", { name: /Saved and synced/i }),
    ).toBeInTheDocument();
    expect(calls[0]?.body).toMatchObject({ action: "link" });
  });

  it("surfaces keep-vs-merge on a 409 conflict and posts the chosen resolution", async () => {
    installFetch((call) => {
      if (
        call.method === "POST" &&
        (call.body as { action: string }).action === "link"
      ) {
        return {
          ok: false,
          status: 409,
          body: {
            status: "credential-already-in-use",
            existingUid: "existing-9",
            anonymousUid: "anon-1",
          },
        };
      }
      // resolve
      return {
        ok: true,
        status: 200,
        body: { status: "merged", targetUid: "existing-9", summary: {} },
      };
    });
    const user = userEvent.setup();
    renderLink();

    await user.click(screen.getByRole("button", { name: /Save my data/i }));

    // The conflict resolver appears and explains both choices.
    const heading = await screen.findByRole("heading", {
      name: /That account already has data/i,
    });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Keep the existing account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Merge anonymous data in/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Merge my data/i }));

    await screen.findByRole("heading", { name: /Merged and saved/i });
    const resolvePost = calls.find(
      (c) => (c.body as { action?: string })?.action === "resolve",
    );
    expect(resolvePost?.body).toMatchObject({
      resolution: "merge",
      targetUid: "existing-9",
    });
  });

  it("keeps anon data intact + focus-manages errors on a failed link", async () => {
    installFetch((call) =>
      call.method === "POST"
        ? { ok: false, status: 500, body: {} }
        : { ok: true, status: 200, body: {} },
    );
    const user = userEvent.setup();
    renderLink();

    await user.click(screen.getByRole("button", { name: /Save my data/i }));
    const alert = await screen.findByText(/still exploring anonymously/i);
    expect(alert).toHaveAttribute("role", "alert");
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });
});
