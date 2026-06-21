"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import type { Category } from "@core/schemas";
import { useAnnouncer } from "../../_components/Announcer";
import { Badge, Chip } from "../../_components/Badge";
import { Button } from "../../_components/Button";
import { Card } from "../../_components/Card";
import { Field, inputClass } from "../../_components/Field";
import {
  AlertTriangle,
  ArrowUpRight,
  ChartLine,
  Gauge,
  PlusLog,
  Ripple,
  Sparkles,
  Target,
} from "../../_components/icons";

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

const ease = [0.16, 1, 0.3, 1] as const;

type CoachFallbackReason =
  | "quota_exceeded"
  | "ai_unavailable"
  | "invalid_ai_output";

interface CoachGrounding {
  totalKg: number;
  topCategory: Category | null;
  topInsightTitles: string[];
  activityCount: number;
}

interface CoachResponse {
  reply: string;
  fallback: boolean;
  reason?: CoachFallbackReason;
  grounding: CoachGrounding;
}

interface UserTurn {
  id: string;
  role: "user";
  text: string;
}

interface CoachTurn {
  id: string;
  role: "coach";
  text: string;
  fallback: boolean;
}

type Turn = UserTurn | CoachTurn;

/** Category → visible label + icon, mirroring the Insights screen vocabulary. */
const CATEGORY_META: Record<Category, { label: string; Icon: typeof Gauge }> = {
  transport: { label: "Transport", Icon: Gauge },
  energy: { label: "Home energy", Icon: Ripple },
  diet: { label: "Food & diet", Icon: Target },
};

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
        transition={{ duration: 0.44, ease }}
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
              <div>
                <p
                  id={`suggested-${reactId}`}
                  className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted"
                >
                  {isEmpty ? "Try asking" : "Or try"}
                </p>
                <ul
                  aria-labelledby={`suggested-${reactId}`}
                  className="mt-2.5 flex flex-wrap gap-2.5"
                >
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <Chip
                        tone="brand"
                        disabled={thinking}
                        onClick={() => void send(prompt)}
                      >
                        {prompt}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </div>
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
          <form onSubmit={handleSubmit} className="mt-5">
            <Field
              id={inputId}
              label="Ask the coach a question"
              hint="Press Enter to send · Shift + Enter for a new line"
            >
              {(controlProps) => (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <textarea
                    {...controlProps}
                    ref={inputRef}
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={2000}
                    // WCAG 2.4.3: stay focusable while the request is in
                    // flight. A `disabled` textarea can't hold focus, so focus
                    // would drop to <body> each send and never return; `readOnly`
                    // keeps focus + tab order, and `aria-busy` tells AT it's busy.
                    readOnly={thinking}
                    aria-busy={thinking}
                    placeholder="e.g. What's my biggest lever right now?"
                    className={`${inputClass(false)} min-h-[64px] resize-y`}
                  />
                  <Button
                    type="submit"
                    loading={thinking}
                    disabled={draft.trim().length === 0}
                    trailingIcon={<ArrowUpRight size={15} />}
                    className="shrink-0 sm:w-auto"
                  >
                    {thinking ? "Sending" : "Send"}
                  </Button>
                </div>
              )}
            </Field>
          </form>
        </section>

        {/* ── Grounding rail ──────────────────────────────────────────────── */}
        <m.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, delay: 0.08, ease }}
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

/* ───────────────────────────── Turns ─────────────────────────────────── */

function TurnRow({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <m.li
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease }}
        className="flex flex-col items-end gap-1.5"
      >
        <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
          You
        </span>
        <p className="max-w-[42ch] text-pretty rounded-2xl rounded-tr-sm bg-surface-brand-subtle px-4 py-3 text-body text-text">
          {turn.text}
        </p>
      </m.li>
    );
  }

  return (
    <m.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease }}
      className="flex flex-col items-start gap-1.5"
    >
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-brand-fg">
        <Ripple size={13} aria-hidden="true" />
        Coach
        {turn.fallback && (
          <Badge tone="neutral" className="ml-1 normal-case tracking-normal">
            General guidance
          </Badge>
        )}
      </span>
      <p
        data-testid="coach-reply"
        className="max-w-[60ch] text-pretty rounded-2xl rounded-tl-sm bg-surface-sunken px-4 py-3 text-body text-text"
      >
        {turn.text}
      </p>
      {turn.fallback && (
        <p className="max-w-[60ch] text-caption text-text-muted">
          The AI coach wasn&rsquo;t available, so this is steady, general
          advice. Your computed figures on the right are unaffected.
        </p>
      )}
    </m.li>
  );
}

function ThinkingRow() {
  return (
    <li aria-hidden="true" className="flex flex-col items-start gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-brand-fg">
        <Ripple size={13} />
        Coach
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-surface-sunken px-4 py-3 text-body text-text-muted">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 rounded-pill bg-text-muted motion-safe:animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-pill bg-text-muted motion-safe:animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-pill bg-text-muted motion-safe:animate-pulse [animation-delay:300ms]" />
        </span>
        Thinking
      </span>
    </li>
  );
}

function ConversationIntro() {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
      >
        <Ripple size={20} />
      </span>
      <div>
        <p className="text-body text-text-secondary">
          Hi — I&rsquo;m your reduction coach. Ask me where to focus next, or
          pick one of the prompts below. I&rsquo;ll talk you through the
          <em> why</em>; the exact figures stay on the right, straight from your
          calculator.
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────── Grounding ──────────────────────────────── */

function GroundingPanel({
  headingId,
  grounding,
}: {
  headingId: string;
  grounding: CoachGrounding | null;
}) {
  const hasData = (grounding?.activityCount ?? 0) > 0;
  const category =
    grounding?.topCategory !== null && grounding?.topCategory !== undefined
      ? CATEGORY_META[grounding.topCategory]
      : null;

  return (
    <Card as="div" accent="brand" pad="lg" innerClassName="flex flex-col gap-5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg"
        >
          <ChartLine size={18} />
        </span>
        <div>
          <h2 id={headingId} className="font-display text-h3 text-text">
            Grounded in your data
          </h2>
          <p className="mt-1 text-caption text-text-muted">
            The coach advises in words; these figures are computed by the
            calculator, not the AI.
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="text-body-sm text-text-secondary">
          No activities yet, so there&rsquo;s nothing to ground the figures in.
          Log an activity and these numbers will fill in.
        </p>
      ) : (
        <dl className="flex flex-col gap-px overflow-hidden rounded-md bg-border">
          <div className="bg-surface-sunken px-4 py-3.5">
            <dt className="text-caption text-text-muted">
              Total footprint logged
            </dt>
            <dd className="numeric mt-1 text-h3 font-medium text-text">
              {grounding!.totalKg.toFixed(2)}{" "}
              <span className="text-body-sm font-normal text-text-muted">
                kg CO₂e
              </span>
            </dd>
          </div>

          <div className="bg-surface-sunken px-4 py-3.5">
            <dt className="text-caption text-text-muted">
              Biggest category so far
            </dt>
            <dd className="mt-1.5">
              {category ? (
                <span className="inline-flex items-center gap-1.5 text-body font-medium text-text">
                  <category.Icon
                    size={17}
                    className="shrink-0 text-brand-fg"
                    aria-hidden="true"
                  />
                  {category.label}
                </span>
              ) : (
                <span className="text-body text-text-secondary">—</span>
              )}
            </dd>
          </div>

          <div className="bg-surface-sunken px-4 py-3.5">
            <dt className="text-caption text-text-muted">Activities counted</dt>
            <dd className="numeric mt-1 text-body font-medium text-text">
              {grounding!.activityCount}
            </dd>
          </div>
        </dl>
      )}

      {hasData && grounding!.topInsightTitles.length > 0 && (
        <div>
          <h3 className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
            Top computed levers
          </h3>
          <ol className="mt-2.5 flex flex-col gap-2">
            {grounding!.topInsightTitles.map((title, i) => (
              <li
                key={title}
                className="flex items-start gap-2.5 text-body-sm text-text-secondary"
              >
                <span
                  aria-hidden="true"
                  className="numeric mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-surface-brand-subtle text-caption font-semibold text-brand-fg"
                >
                  {i + 1}
                </span>
                <span className="text-text">{title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="border-t border-border pt-4 text-caption text-text-muted">
        Every figure here is derived by our deterministic calculator from
        published emission factors.{" "}
        <Link
          href="/insights"
          className="rounded-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
        >
          See the ranked insights
        </Link>
        .
      </p>
    </Card>
  );
}

/* ───────────────────────────── Empty ──────────────────────────────────── */

function EmptyCoach() {
  return (
    <Card
      as="section"
      aria-labelledby="coach-empty-title"
      elevation="raised"
      accent="brand"
      pad="none"
      innerClassName="relative overflow-hidden px-6 py-14 text-center md:px-10 md:py-16"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 rounded-pill bg-surface-brand-subtle opacity-60 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-[46ch] flex-col items-center">
        <span
          aria-hidden="true"
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
        >
          <Sparkles size={28} />
        </span>
        <h2
          id="coach-empty-title"
          className="mt-6 text-balance font-display text-h2 text-text"
        >
          Log an activity to coach on
        </h2>
        <p className="mt-3 text-pretty text-body text-text-secondary">
          Your coach reasons from your own footprint. Once you&rsquo;ve logged a
          few activities — or loaded the sample data — it can point you at the
          swap that cuts the most, with every figure computed, never guessed.
        </p>
        <div className="mt-8">
          <Link
            href="/log"
            className="group inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            <PlusLog size={18} aria-hidden="true" />
            Log an activity
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
            >
              <ArrowUpRight size={15} />
            </span>
          </Link>
        </div>
      </div>
    </Card>
  );
}
