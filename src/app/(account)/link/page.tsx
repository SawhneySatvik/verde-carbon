"use client";

import { useEffect, useId, useRef, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { useAnnouncer } from "../../_components/Announcer";
import { Card } from "../../_components/Card";
import { Badge } from "../../_components/Badge";
import { AlertTriangle, Lock } from "../../_components/icons";
import { CarriesOverSection } from "./_components/CarriesOverSection";
import { ProviderForm } from "./_components/ProviderForm";
import { ConflictResolver } from "./_components/ConflictResolver";
import { StatusSpinner } from "./_components/StatusSpinner";
import { SuccessScreen } from "./_components/SuccessScreen";

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
 * This file owns the phase machine, credential state, the `handleLink()` /
 * `resolve()` callbacks and focus management; the visual sections live in
 * co-located `_components/` sub-components wired below.
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

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

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
        transition={{ duration: 0.48, ease: EASE_OUT_QUART }}
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
        <m.div
          {...reveal}
          transition={{ duration: 0.32, ease: EASE_OUT_QUART }}
        >
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
      <CarriesOverSection reactId={reactId} />

      {showForm && (
        <ProviderForm
          reactId={reactId}
          provider={provider}
          setProvider={setProvider}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={phase.kind === "linking"}
          onSubmit={handleLink}
        />
      )}

      {phase.kind === "conflict" && (
        <ConflictResolver
          reactId={reactId}
          headingRef={conflictHeadingRef}
          onResolve={(resolution) => void resolve(resolution)}
        />
      )}

      {phase.kind === "resolving" && <StatusSpinner />}

      {done && (
        <SuccessScreen kind={phase.kind as "linked" | "merged" | "kept"} />
      )}
    </div>
  );
}
