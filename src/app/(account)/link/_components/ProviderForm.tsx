"use client";

import { m } from "motion/react";
import Link from "next/link";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { Field, Input } from "../../../_components/Field";
import { ArrowUpRight } from "../../../_components/icons";

/**
 * Provider sign-in form — provider radios plus the conditional email/password
 * fields (manager-fillable, standard autocomplete, no cognitive test).
 */

type Provider = "google" | "password";

/** Shared entrance — opacity + small translate only (reduced-motion safe). */
const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function ProviderForm({
  reactId,
  provider,
  setProvider,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  onSubmit,
}: {
  reactId: string;
  provider: Provider;
  setProvider: (provider: Provider) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <m.div
      {...reveal}
      transition={{ duration: 0.48, delay: 0.12, ease: EASE_OUT_QUART }}
    >
      <Card as="section" pad="lg">
        <form onSubmit={onSubmit}>
          <fieldset>
            <legend className="text-h4 text-text">Choose how to sign in</legend>
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
              loading={loading}
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
  );
}
