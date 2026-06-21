import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageLogger } from "./ImageLogger";
import { ParseConfirmation } from "./ParseConfirmation";
import { AnnouncerProvider } from "../../../_components/Announcer";
import type { Unit } from "@core/schemas";

/**
 * ImageLogger (image-mode log entry).
 *
 * The load-bearing assertions mirror the NL path's "show before save"
 * contract for IMAGES:
 *  - clicking a "Try a sample image" button reads the bundled sample → POSTs
 *    /api/parse-image with imageMediaType:'image/png' + the right context, and
 *    hands the parsed items UP via onParsed — which feeds the SAME
 *    ParseConfirmation breakdown;
 *  - NOTHING is persisted by the image path (no POST /api/activities at all) —
 *    persistence only ever happens later, when the user clicks "Log it" in the
 *    shared confirm flow;
 *  - a non-blocking { fallback:true } response (or a 413) shows the reason
 *    IN-CONTEXT (never a hard error) and calls onFallback.
 */

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

let calls: RecordedCall[];

/** Tiny deterministic PNG-ish blob payload for the sample fetch. */
const SAMPLE_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function installFetch(
  parseImageResponder: () => { status?: number; json: unknown },
) {
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, method: init?.method ?? "GET", body });

    if (u.includes("/samples/")) {
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob([SAMPLE_BYTES], { type: "image/png" }),
      } as unknown as Response;
    }
    if (u.includes("/api/parse-image")) {
      const out = parseImageResponder();
      return {
        ok: (out.status ?? 200) < 400,
        status: out.status ?? 200,
        json: async () => out.json,
      } as unknown as Response;
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

/** True for ANY POST /api/activities (the image path must make zero of these). */
function isActivitiesPost(c: RecordedCall): boolean {
  return c.method === "POST" && c.url.includes("/api/activities");
}

/**
 * The page renders TWO alert regions: the global sr-only announcer (which also
 * mirrors assertive messages) and ImageLogger's in-context visible alert. Find
 * the VISIBLE one (the component's own, not the `.sr-only` announcer) so the
 * test asserts the real in-context surface, not the announcer mirror.
 */
async function findVisibleAlert(text: RegExp): Promise<HTMLElement> {
  return waitFor(() => {
    const visible = screen
      .getAllByRole("alert")
      .find(
        (el) =>
          !el.classList.contains("sr-only") && text.test(el.textContent ?? ""),
      );
    if (!visible) throw new Error("no visible in-context alert yet");
    return visible;
  });
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Render ImageLogger wired to a real ParseConfirmation the way the page does:
 * onParsed lifts the items into the shared confirm surface. This proves the
 * image result flows into the SAME show-before-save breakdown.
 */
function renderWired(onConfirm = vi.fn()) {
  function Harness() {
    const [items, setItems] = useState<Array<{
      activity: string;
      value: number;
      unit: Unit;
      candidateFactorKey: string;
    }> | null>(null);
    const [reason, setReason] = useState<string | null>(null);
    return (
      <>
        {items ? (
          <ParseConfirmation
            parsedItems={items}
            onConfirm={onConfirm}
            onCancel={() => setItems(null)}
          />
        ) : (
          <ImageLogger
            onParsed={(parsed) => setItems(parsed)}
            onFallback={(r) => setReason(r)}
          />
        )}
        {reason ? <p data-testid="lifted-reason">{reason}</p> : null}
      </>
    );
  }
  render(
    <AnnouncerProvider>
      <Harness />
    </AnnouncerProvider>,
  );
  return onConfirm;
}

describe("ImageLogger — sample image → parse → ParseConfirmation (no persist)", () => {
  it("posts the sample to /api/parse-image with the right media type + context, then shows the SAME breakdown", async () => {
    installFetch(() => ({
      json: {
        fallback: false,
        parse: {
          items: [
            {
              activity: "beef burger",
              value: 1,
              unit: "meal",
              candidateFactorKey: "diet.meal.beef",
              confidence: 0.86,
            },
          ],
        },
      },
    }));

    const user = userEvent.setup();
    renderWired();

    await user.click(screen.getByRole("button", { name: /Beef burger meal/i }));

    // The image was POSTed to /api/parse-image as PNG with context "meal".
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/api/parse-image"))).toBe(true),
    );
    const post = calls.find((c) => c.url.includes("/api/parse-image"))!;
    expect(post.method).toBe("POST");
    expect(post.body).toMatchObject({
      imageMediaType: "image/png",
      context: "meal",
    });
    expect(typeof (post.body as { imageBase64?: unknown }).imageBase64).toBe(
      "string",
    );

    // The parsed item is handed to the SAME ParseConfirmation breakdown.
    expect(
      await screen.findByRole("heading", {
        name: /Check this before you save/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("beef burger")).toBeInTheDocument();

    // CRITICAL: the image path persisted NOTHING. The only confirm/persist
    // happens later via "Log it" (covered by the page/e2e tests).
    expect(calls.some(isActivitiesPost)).toBe(false);
  });

  it("sends context 'receipt' and surfaces all parsed line items for a receipt sample", async () => {
    installFetch(() => ({
      json: {
        fallback: false,
        parse: {
          items: [
            {
              activity: "beef (grocery)",
              value: 2,
              unit: "meal",
              candidateFactorKey: "diet.meal.beef",
              confidence: 0.71,
            },
            {
              activity: "chicken (grocery)",
              value: 3,
              unit: "meal",
              candidateFactorKey: "diet.meal.chicken",
              confidence: 0.68,
            },
          ],
        },
      },
    }));

    const user = userEvent.setup();
    renderWired();
    await user.click(screen.getByRole("button", { name: /Grocery receipt/i }));

    await waitFor(() =>
      expect(
        calls.find((c) => c.url.includes("/api/parse-image"))?.body,
      ).toMatchObject({ context: "receipt", imageMediaType: "image/png" }),
    );

    await screen.findByRole("heading", { name: /Check this before you save/i });
    expect(screen.getByDisplayValue("beef (grocery)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("chicken (grocery)")).toBeInTheDocument();
    expect(calls.some(isActivitiesPost)).toBe(false);
  });
});

describe("ImageLogger — non-blocking fallback (never a hard error, no persist)", () => {
  it("shows the reason in-context and calls onFallback when the parser signals fallback", async () => {
    installFetch(() => ({
      json: {
        fallback: true,
        reason: "no_items",
        message: "No items could be read from this image.",
      },
    }));

    const user = userEvent.setup();
    renderWired();
    await user.click(screen.getByRole("button", { name: /Veggie bowl meal/i }));

    // The non-blocking reason is shown in-context (a visible role=alert, NOT the
    // sr-only announcer region), and the preview is retained so the user can
    // retry — never thrown as a hard error.
    const alert = await findVisibleAlert(/No items could be read/i);
    expect(alert).toHaveTextContent(/No items could be read/i);
    // onFallback fired (the lifted reason is rendered by the harness).
    expect(await screen.findByTestId("lifted-reason")).toHaveTextContent(
      /No items could be read/i,
    );
    // The retained preview image keeps an accessible alt.
    expect(
      screen.getByRole("img", { name: /Veggie bowl meal/i }),
    ).toBeInTheDocument();
    expect(calls.some(isActivitiesPost)).toBe(false);
  });

  it("treats a 413 oversize response as a non-blocking reason, not a crash", async () => {
    installFetch(() => ({ status: 413, json: {} }));

    const user = userEvent.setup();
    renderWired();
    await user.click(screen.getByRole("button", { name: /Beef burger meal/i }));

    const alert = await findVisibleAlert(/too large/i);
    expect(alert).toHaveTextContent(/too large/i);
    expect(calls.some(isActivitiesPost)).toBe(false);
  });
});

describe("ImageLogger — accessibility wiring", () => {
  it("exposes a real labelled file input (image/*, camera capture) and ≥3 sample buttons", () => {
    installFetch(() => ({ json: { fallback: false, parse: { items: [] } } }));
    render(
      <AnnouncerProvider>
        <ImageLogger onParsed={vi.fn()} onFallback={vi.fn()} />
      </AnnouncerProvider>,
    );

    const input = screen.getByLabelText(/Choose a photo to log/i);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input).toHaveAttribute("capture", "environment");

    // Three real <button> sample triggers.
    expect(
      screen.getByRole("button", { name: /Beef burger meal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Veggie bowl meal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Grocery receipt/i }),
    ).toBeInTheDocument();
  });
});
