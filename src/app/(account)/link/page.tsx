"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { useAnnouncer } from "../../_components/Announcer";
import { Button } from "../../_components/Button";
import { Card } from "../../_components/Card";
import { Badge } from "../../_components/Badge";
import { Field, Input } from "../../_components/Field";
import { BrandMark } from "../../_components/BrandMark";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  ChartLine,
  Lock,
  Ripple,
  Target,
} from "../../_components/icons";

/**
 * Account-linking / Sign-in.
 *
 * Saves & syncs the anonymous session's data by linking it to a sign-in
 * credential. The surface is built on the Double-Bezel `Card` material, the
 * icon set (no emoji/Unicode), `Field`/`Input`/`Button` primitives, and a
 * tasteful `m`-driven entrance (transform/opacity only, reduced-motion safe via
 * the shared MotionProvider's `MotionConfig reducedMotion="user"`). Content is
 * visible by default — the reveal only enhances.
 *
 * PRESERVED (non-negotiable):
 *  - WCAG 2.2 3.3.8 Accessible Authentication: standard provider sign-in only —
 *    NO cognitive-function test (no puzzle/CAPTCHA), credentials may be
 *    pasted/managed (`autocomplete="username"` / `"current-password"`,
 *    password-manager-fillable), fields have real labels.
 *  - The "what carries over" explainer states exactly what the link preserves.
 *  - The keep-vs-merge resolver wired to `POST /api/account/link` INCLUDING the
 *    credential re-presentation on merge: the server verifies the target is the
 *    credential's true owner before merging (never trusts `targetUid`). Nothing
 *    is overwritten silently.
 *  - Focus management (error → alert; conflict → heading) + error handling, and
 *    anon data left intact on cancel.
 */

type Provider = "google" | "password";

type Phase =
  | { kind: "idle" }
  | { kind: "linking" }
  | { kind: "linked" }
  | { kind: "kept" }
  | {
      kind: "conflict";
      existingUid: string;
      anonymousUid: string;
      idempotencyKey: string;
      // Retained so the merge can RE-PRESENT it — the server verifies the target
      // is the credential's true owner before merging (never trusts targetUid).
      credential: { provider: Provider; token: string };
    }
  | { kind: "resolving" }
  | { kind: "merged" };

const CARRIES: ReadonlyArray<{
  Icon: (props: { size?: number; className?: string }) => React.ReactElement;
  text: React.ReactNode;
}> = [
  {
    Icon: Target,
    text: "Your baseline footprint from onboarding",
  },
  {
    Icon: ChartLine,
    text: <>Every activity you&rsquo;ve logged, with its original source</>,
  },
  {
    Icon: Ripple,
    text: "Your goal and your logging streak",
  },
];

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};
const ease = [0.16, 1, 0.3, 1] as const;

export default function LinkPage() {
  const { announce } = useAnnouncer();
  const reactId = useId();
  const [provider, setProvider] = useState<Provider>("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const conflictHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    if (phase.kind === "conflict") {
      conflictHeadingRef.current?.focus();
    }
  }, [phase.kind]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (provider === "password" && (email.trim() === "" || password === "")) {
      setError("Enter your email and password to continue.");
      return;
    }
    setPhase({ kind: "linking" });
    announce("Linking your account…");
    try {
      // The provider token is obtained from the standard client SDK
      // (linkWithCredential). In the local-first build the route's AuthPort mock
      // accepts an opaque token; the conflict path is exercised by the server.
      const token =
        provider === "password"
          ? `${email}::${password}`
          : "google-oauth-token";
      const credential = { provider, token };
      const res = await fetch("/api/account/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "link",
          credential,
        }),
      });
      const data = (await res.json()) as
        | { status: "linked"; uid: string }
        | {
            status: "credential-already-in-use";
            existingUid: string;
            anonymousUid: string;
          };

      if (res.status === 409 && data.status === "credential-already-in-use") {
        announce(
          "That account already has data. Choose how to combine it.",
          "assertive",
        );
        setPhase({
          kind: "conflict",
          existingUid: data.existingUid,
          anonymousUid: data.anonymousUid,
          idempotencyKey: `merge-${data.anonymousUid}-${data.existingUid}`,
          credential,
        });
        return;
      }
      if (!res.ok) {
        throw new Error("link failed");
      }
      announce("Signed in. Your data is now saved and synced.", "assertive");
      setPhase({ kind: "linked" });
    } catch {
      setError(
        "Sign-in didn't complete. You're still exploring anonymously — none of your data was lost. Try again.",
      );
      setPhase({ kind: "idle" });
    }
  }

  async function resolve(resolution: "keep" | "merge") {
    if (phase.kind !== "conflict") {
      return;
    }
    setError(null);
    const { existingUid, anonymousUid, idempotencyKey, credential } = phase;
    setPhase({ kind: "resolving" });
    announce(
      resolution === "merge"
        ? "Merging your anonymous data…"
        : "Keeping the existing account…",
    );
    try {
      // Merge RE-PRESENTS the credential so the server can verify the target is
      // its true owner; keep needs nothing beyond the resolution.
      const requestBody =
        resolution === "merge"
          ? {
              action: "resolve",
              resolution,
              credential,
              targetUid: existingUid,
              idempotencyKey,
            }
          : { action: "resolve", resolution };
      const res = await fetch("/api/account/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        throw new Error("resolve failed");
      }
      if (resolution === "merge") {
        announce("Merged. Everything is now in one account.", "assertive");
        setPhase({ kind: "merged" });
      } else {
        announce(
          "Kept the existing account. Your anonymous data is untouched.",
          "assertive",
        );
        setPhase({ kind: "kept" });
      }
    } catch {
      setError(
        "We couldn't complete that. Nothing was changed — your data is intact. Try again.",
      );
      setPhase({
        kind: "conflict",
        existingUid,
        anonymousUid,
        idempotencyKey,
        credential,
      });
    }
  }

  const showForm = phase.kind === "idle" || phase.kind === "linking";
  const done =
    phase.kind === "linked" || phase.kind === "merged" || phase.kind === "kept";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20">
      <m.header
        {...reveal}
        transition={{ duration: 0.48, ease }}
        className="mb-10"
      >
        <Badge tone="brand" eyebrow icon={<Lock size={13} />}>
          Save &amp; sync
        </Badge>
        <h1 className="mt-4 max-w-[18ch] text-balance font-display text-h1 text-text">
          Save your data, keep your progress
        </h1>
        <p className="mt-4 max-w-[56ch] text-pretty text-body-lg text-text-secondary">
          Sign in to link this anonymous session to an account — nothing starts
          over, and you can keep exploring without one. Saving is optional.
        </p>
      </m.header>

      {error && (
        <m.div {...reveal} transition={{ duration: 0.32, ease }}>
          <Card accent="danger" pad="none" className="mb-6">
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="relative p-5 pl-12 text-body-sm text-danger-fg focus:outline-none"
            >
              <AlertTriangle
                size={20}
                className="absolute left-5 top-5 shrink-0"
                aria-hidden="true"
              />
              {error}
            </p>
          </Card>
        </m.div>
      )}

      {/* What carries over — the explainer, always visible before linking. */}
      <m.section
        {...reveal}
        transition={{ duration: 0.48, delay: 0.06, ease }}
        aria-labelledby={`carries-${reactId}`}
        className="mb-6"
      >
        <Card pad="lg">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg shadow-bezel-inner ring-1 ring-[--bezel-ring]"
            >
              <BrandMark size={22} />
            </span>
            <div>
              <h2
                id={`carries-${reactId}`}
                className="font-display text-h3 text-text"
              >
                What carries over
              </h2>
              <p className="mt-2 max-w-[60ch] text-body text-text-secondary">
                Signing in links your current anonymous session to your account
                — it does not start over. Everything you&rsquo;ve done so far
                comes with you:
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {CARRIES.map(({ Icon, text }, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-md bg-surface-sunken p-4"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex shrink-0 text-brand-fg"
                >
                  <Icon size={18} />
                </span>
                <span className="text-body-sm text-text-secondary">{text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-body-sm text-text-muted">
            Nothing is re-entered and nothing is deleted. You can keep exploring
            anonymously instead — saving is optional.
          </p>
        </Card>
      </m.section>

      {showForm && (
        <m.div {...reveal} transition={{ duration: 0.48, delay: 0.12, ease }}>
          <Card as="section" pad="lg">
            <form onSubmit={handleLink}>
              <fieldset>
                <legend className="text-h4 text-text">
                  Choose how to sign in
                </legend>
                <p className="mt-1 text-body-sm text-text-secondary">
                  Standard provider sign-in — no puzzle or image test to solve.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "google",
                        label: "Continue with Google",
                        sub: "Use your Google account",
                      },
                      {
                        value: "password",
                        label: "Email & password",
                        sub: "Manager-fillable, no CAPTCHA",
                      },
                    ] as const
                  ).map((opt) => {
                    const checked = provider === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                          "transition-colors duration-fast ease-out-quart",
                          checked
                            ? "border-brand bg-surface-brand-subtle"
                            : "border-border-interactive bg-surface hover:bg-surface-hover",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="provider"
                          value={opt.value}
                          checked={checked}
                          onChange={() => setProvider(opt.value)}
                          className="mt-0.5 h-4 w-4 shrink-0 border-border-interactive text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                        />
                        <span className="min-w-0">
                          <span
                            className={[
                              "block text-body font-medium",
                              checked ? "text-brand-fg" : "text-text",
                            ].join(" ")}
                          >
                            {opt.label}
                          </span>
                          <span className="mt-0.5 block text-caption text-text-muted">
                            {opt.sub}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {provider === "password" && (
                <div className="mt-6 space-y-4">
                  <Field
                    label="Email"
                    id={`email-${reactId}`}
                    hint="Your browser's password manager can fill this — there is no puzzle or image test to solve."
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label="Password" id={`password-${reactId}`}>
                    {(props) => (
                      <Input
                        {...props}
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  loading={phase.kind === "linking"}
                  trailingIcon={<ArrowUpRight size={18} />}
                >
                  Save my data
                </Button>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[44px] items-center rounded-sm px-1 text-body-sm text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
                >
                  Keep exploring anonymously
                </Link>
              </div>
            </form>
          </Card>
        </m.div>
      )}

      {phase.kind === "conflict" && (
        <m.section
          {...reveal}
          transition={{ duration: 0.4, ease }}
          aria-labelledby={`conflict-${reactId}`}
        >
          <Card accent="warning" pad="lg">
            <h2
              id={`conflict-${reactId}`}
              ref={conflictHeadingRef}
              tabIndex={-1}
              className="inline-flex items-center gap-2 font-display text-h3 text-warning-fg focus:outline-none"
            >
              <AlertTriangle
                size={22}
                className="shrink-0"
                aria-hidden="true"
              />
              That account already has data
            </h2>
            <p className="mt-3 max-w-[62ch] text-body text-text-secondary">
              The sign-in you chose is already linked to another account that
              has its own saved data. Choose what to do — nothing happens until
              you pick, and neither set is overwritten silently.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col rounded-lg bg-surface-sunken p-5">
                <h3 className="text-h4 text-text">Keep the existing account</h3>
                <p className="mt-2 flex-1 text-body-sm text-text-secondary">
                  Sign in to that account as-is. Your current anonymous data
                  stays where it is and is <strong>not</strong> merged in — you
                  can come back to it.
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => void resolve("keep")}
                  >
                    Keep existing data
                  </Button>
                </div>
              </div>

              <div className="flex flex-col rounded-lg bg-surface-sunken p-5">
                <h3 className="text-h4 text-text">Merge anonymous data in</h3>
                <p className="mt-2 flex-1 text-body-sm text-text-secondary">
                  Copy everything from this anonymous session into the existing
                  account. Both sets are combined; nothing is deleted. This can
                  be run safely without duplicating.
                </p>
                <div className="mt-4">
                  <Button fullWidth onClick={() => void resolve("merge")}>
                    Merge my data
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </m.section>
      )}

      {phase.kind === "resolving" && (
        <Card pad="lg">
          <p
            role="status"
            className="flex items-center gap-2.5 text-body text-text-secondary"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 motion-safe:animate-spin"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  opacity="0.25"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Working on it…
          </p>
        </Card>
      )}

      {done && (
        <m.div {...reveal} transition={{ duration: 0.4, ease }}>
          <Card accent="success" pad="lg" role="status">
            <h2 className="inline-flex items-center gap-2 font-display text-h3 text-success-fg">
              <CheckCircle size={22} className="shrink-0" aria-hidden="true" />
              {phase.kind === "merged"
                ? "Merged and saved"
                : phase.kind === "kept"
                  ? "Signed in to your existing account"
                  : "Saved and synced"}
            </h2>
            <p className="mt-3 max-w-[60ch] text-body text-text-secondary">
              {phase.kind === "kept"
                ? "Your anonymous data is untouched and still here for you."
                : "Your data is now saved to your account and will sync across devices."}
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="group inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-brand px-6 py-3 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
              >
                Back to dashboard
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-[rgba(255,255,255,0.16)] transition-transform duration-fast ease-out-soft motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                >
                  <ArrowUpRight size={15} />
                </span>
              </Link>
            </div>
          </Card>
        </m.div>
      )}
    </div>
  );
}
