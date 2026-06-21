"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge } from "../../_components/Badge";
import { Card } from "../../_components/Card";
import { AlertTriangle, Sparkles } from "../../_components/icons";
import { Composer } from "./_components/Composer";
import { ConversationIntro } from "./_components/ConversationIntro";
import { EmptyCoach } from "./_components/EmptyCoach";
import { GroundingPanel } from "./_components/GroundingPanel";
import { SuggestedPrompts } from "./_components/SuggestedPrompts";
import { ThinkingRow } from "./_components/ThinkingRow";
import { TurnRow } from "./_components/TurnRow";
import type {
  CoachGrounding,
  CoachResponse,
  CoachTurn,
  Turn,
  UserTurn,
} from "./_components/types";

/**
 * Conversational Coach — chat surface.
 *
 * THE LOAD-BEARING SPLIT (ADR-001): the coach advises in WORDS and the calculator
 * supplies the NUMBERS. The AI `reply` from `POST /api/coach` is guaranteed
 * DIGIT-FREE (re-validated server-side); every figure the user sees — total kg,
 * top category, the top-3 insight titles — comes from the response's `grounding`
 * block, which the deterministic calculator produced from the user's own logs.
 * We make that split EXPLICIT in the UI: the conversation column carries the
 * worded advice, and a separate "Grounded in your data" panel carries the
 * computed figures in tabular Geist-Mono with a plain-language disclaimer.
 *
 * Soft Structuralism: the page is a two-column composition at lg (conversation +
 * sticky grounding rail), collapsing to a single column on phones. The message
 * log is a real semantic <ol> of turns; coach replies are announced via the
 * shared aria-live region; suggested-prompt chips are real <button>s; the
 * composer is a labelled textarea + a ≥44px send Button. Motion is `m`-driven
 * (transform/opacity only, reduced-motion safe via the shared MotionProvider).
 *
 * Degrade, never block: the route returns 200 with `fallback: true` and a
 * neutral, digit-free reply when the AI path can't be trusted — we render that as
 * a normal coach turn (NOT an error), only flagging it quietly as "general
 * guidance". A genuine network/transport failure shows an inline, retryable error
 * that never destroys the user's typed message.
 */

/** Starter prompts — real buttons that prefill + send. */
const SUGGESTED_PROMPTS: readonly string[] = [
  "What's my biggest lever?",
  "How do I cut transport?",
  "Where should I start this week?",
  "What's an easy win for my diet?",
];

let turnSeq = 0;
function nextTurnId(prefix: string): string {
  turnSeq += 1;
  return `${prefix}-${turnSeq}`;
}

export default function CoachPage() {
  const { announce } = useAnnouncer();
  const reactId = useId();
  const inputId = `coach-input-${reactId}`;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [grounding, setGrounding] = useState<CoachGrounding | null>(null);
  const [primed, setPrimed] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  // Tracks an in-flight send so we restore composer focus only after a real
  // round-trip (not on mount). Set true when `thinking` flips on; consumed when
  // it flips off.
  const sendInFlight = useRef(false);

  // Prime the grounding panel once on mount from the user's own data. We send a
  // neutral opener purely to fetch `grounding`; we do NOT render its reply as a
  // turn — the conversation starts empty so the suggested prompts lead. If the
  // call fails we simply leave the panel in its "no data yet" state.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "Give me a quick orientation." }),
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as CoachResponse;
        if (!cancelled) {
          setGrounding(data.grounding);
        }
      } catch {
        // Silent: the panel stays in its empty state; the composer still works.
      } finally {
        if (!cancelled) {
          setPrimed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (networkError) {
      errorRef.current?.focus();
    }
  }, [networkError]);

  // WCAG 2.4.3: when a send completes, restore focus to the composer.
  // Activating a suggested-prompt chip disables it mid-click (dropping focus),
  // so on the `thinking` true→false transition of an actual send we pull focus
  // back to the textarea — keyboard/SR users continue the conversation in place
  // instead of being dumped to the top of the document. The aria-live reply
  // announcement is unaffected (it never steals focus). On a network failure the
  // error alert's own focus management (above) wins, since it runs in the same
  // commit and the alert is the more urgent target.
  useEffect(() => {
    if (thinking) {
      sendInFlight.current = true;
      return;
    }
    if (sendInFlight.current) {
      sendInFlight.current = false;
      if (!networkError) {
        inputRef.current?.focus();
      }
    }
  }, [thinking, networkError]);

  const send = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim();
      if (message.length === 0 || thinking) {
        return;
      }
      setNetworkError(null);
      setDraft("");
      const userTurn: UserTurn = {
        id: nextTurnId("user"),
        role: "user",
        text: message,
      };
      setTurns((prev) => [...prev, userTurn]);
      setThinking(true);
      announce("Coach is thinking…");

      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message,
            timeZone:
              typeof Intl !== "undefined"
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : undefined,
          }),
        });
        if (!res.ok) {
          throw new Error(`coach request failed (${res.status})`);
        }
        const data = (await res.json()) as CoachResponse;
        const coachTurn: CoachTurn = {
          id: nextTurnId("coach"),
          role: "coach",
          text: data.reply,
          fallback: data.fallback,
        };
        setTurns((prev) => [...prev, coachTurn]);
        setGrounding(data.grounding);
        // `fallback:true` is still a valid, helpful coach reply — announce it as
        // advice, not as an error.
        announce(`Coach replied: ${data.reply}`);
      } catch {
        setNetworkError(
          "We couldn't reach the coach just now. Your message is saved below — try sending again.",
        );
        // Re-arm the draft so the user never loses what they typed.
        setDraft(message);
        announce(
          "We couldn't reach the coach. Your message was kept.",
          "assertive",
        );
      } finally {
        setThinking(false);
      }
    },
    [announce, thinking],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(draft);
    // Keep focus on the composer for a natural back-and-forth (the new reply is
    // announced via aria-live, so focus need not jump to it).
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline (a familiar chat affordance).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  const isEmpty = turns.length === 0;
  const hasActivities = (grounding?.activityCount ?? 0) > 0;

  return (
    <div className="mx-auto max-w-app px-4 py-12 md:px-6 md:py-16 lg:px-8">
      <m.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.44, ease: EASE_OUT_QUART }}
        className="mb-10 max-w-prose"
      >
        <Badge tone="brand" eyebrow icon={<Sparkles size={13} />}>
          Conversational coach
        </Badge>
        <h1 className="mt-3 text-balance font-display text-h1 text-text">
          Ask your coach
        </h1>
        <p className="mt-3 text-pretty text-body-lg text-text-secondary">
          A friendly nudge toward your next reduction. The coach advises in
          words; the figures it reasons from are computed by our calculator from
          your own logs — never invented.
        </p>
      </m.header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        {/* ── Conversation column ─────────────────────────────────────────── */}
        <section
          aria-labelledby={`conversation-${reactId}`}
          className="min-w-0"
        >
          <h2 id={`conversation-${reactId}`} className="sr-only">
            Conversation with your coach
          </h2>

          {isEmpty && primed && !hasActivities ? (
            <EmptyCoach />
          ) : (
            <Card as="div" pad="lg" innerClassName="flex flex-col gap-6">
              {isEmpty ? (
                <ConversationIntro />
              ) : (
                <ol className="flex flex-col gap-5">
                  {turns.map((turn) => (
                    <TurnRow key={turn.id} turn={turn} />
                  ))}
                  {thinking && <ThinkingRow />}
                </ol>
              )}

              {/* Suggested prompts — real buttons that prefill + send. */}
              <SuggestedPrompts
                headingId={`suggested-${reactId}`}
                label={isEmpty ? "Try asking" : "Or try"}
                prompts={SUGGESTED_PROMPTS}
                onPick={(prompt) => void send(prompt)}
                disabled={thinking}
              />
            </Card>
          )}

          {/* Network error — distinct from a `fallback` reply (which is normal). */}
          {networkError && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mt-4 inline-flex items-start gap-2 rounded-md border border-danger/40 bg-danger-bg p-4 text-body-sm text-danger-fg focus:outline-none"
            >
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              {networkError}
            </p>
          )}

          {/* Composer */}
          <Composer
            id={inputId}
            inputRef={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onSubmit={handleSubmit}
            busy={thinking}
            disabled={draft.trim().length === 0}
          />
        </section>

        {/* ── Grounding rail ──────────────────────────────────────────────── */}
        <m.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, delay: 0.08, ease: EASE_OUT_QUART }}
          aria-labelledby={`grounding-${reactId}`}
          className="lg:sticky lg:top-6"
        >
          <GroundingPanel
            headingId={`grounding-${reactId}`}
            grounding={grounding}
          />
        </m.aside>
      </div>
    </div>
  );
}
