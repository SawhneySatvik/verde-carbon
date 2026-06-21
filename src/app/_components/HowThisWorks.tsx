import Link from "next/link";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { CheckCircle } from "./icons";

/**
 * "How this works" transparency explainer. A secondary "How this works" opens the
 * transparency explainer.
 *
 * States the honesty promise plainly: the AI only PARSES your words into
 * structured items, the deterministic calculator COMPUTES every CO₂e number, and
 * every number is traceable to a published source (EPA / DEFRA-DESNZ). Static,
 * server-rendered prose — no client state, no motion required here (the welcome
 * hero carries the brand's motion moment; this surface is a calm reading page).
 *
 * Layout: an editorial split-rule numbered list — a hairline-separated column of
 * steps with big Space-Grotesk numerals in the margin, capped to the reading
 * measure, closing on a Double-Bezel "the one rule we never break" pledge card.
 * One semantic <h1>; each step is an <h2> in order.
 */

const STEPS: ReadonlyArray<{
  n: string;
  title: string;
  body: string;
}> = [
  {
    n: "01",
    title: "You describe an activity in plain language",
    body: "Type something like “drove 20 miles to work in my gas car”. You never have to learn factor codes or units — though a structured form is always available if you prefer it.",
  },
  {
    n: "02",
    title: "AI only parses — it never invents a number",
    body: "The language model turns your sentence into structured items (activity, quantity, unit, a candidate factor). It is structurally prevented from returning a CO₂e figure; any stray number it emits is stripped before you ever see it.",
  },
  {
    n: "03",
    title: "A deterministic calculator computes every CO₂e",
    body: "Your quantity is converted to the factor’s canonical unit and multiplied by a published emission factor. The same inputs always give the same number — no estimation, no model guesswork.",
  },
  {
    n: "04",
    title: "Every number is sourced — and shown before you save",
    body: "Each line shows the factor it used and a link to its published source (EPA GHG Factors Hub or UK DEFRA/DESNZ). You see the parsed items, the computed CO₂e, and the source before anything is saved.",
  },
];

export function HowThisWorks() {
  return (
    <div className="mx-auto max-w-app px-4 py-16 md:px-6 md:py-24 lg:px-8">
      {/* ----------------------------------------------------- editorial head */}
      <section
        aria-labelledby="how-it-works-title"
        className="grid gap-10 lg:grid-cols-12"
      >
        <div className="lg:col-span-7">
          <Badge tone="brand" eyebrow>
            Our honesty promise
          </Badge>
          <h1
            id="how-it-works-title"
            className="mt-5 max-w-[14ch] text-balance font-display text-[clamp(2.25rem,5vw,3.25rem)] font-bold leading-[1.06] tracking-[-0.02em] text-text"
          >
            How Verdé works
          </h1>
          <p className="mt-6 max-w-[56ch] text-pretty text-body-lg text-text-secondary">
            Verdé is built so you can trust every figure. The AI helps you
            describe what you did; it does not decide your footprint. A
            transparent calculator does that, from numbers you can check
            yourself.
          </p>
        </div>

        {/* The pledge, lifted as a floating bento tile beside the intro. */}
        <div className="lg:col-span-5 lg:self-end">
          <Card
            elevation="raised"
            accent="brand"
            pad="lg"
            innerClassName="flex flex-col gap-3"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-brand-subtle text-brand-fg ring-1 ring-[--bezel-ring]"
            >
              <CheckCircle size={22} />
            </span>
            <h2 className="font-display text-h3 text-text">
              The one rule we never break
            </h2>
            <p className="text-body text-text-secondary">
              AI never supplies a number. Any CO₂e you see is the
              calculator&rsquo;s, traceable to a published factor. If we
              can&rsquo;t source a figure, we tell you and leave it out of your
              total — we never guess.
            </p>
          </Card>
        </div>
      </section>

      {/* --------------------------------------------------- numbered steps */}
      <section aria-label="How a figure is produced" className="mt-16 md:mt-20">
        <ol className="max-w-prose border-t border-border">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-1 border-b border-border py-8 first:pt-10 md:gap-x-8"
            >
              <span
                aria-hidden="true"
                className="numeric font-display text-h2 leading-none text-brand-fg/80"
              >
                {step.n}
              </span>
              <div>
                <h2 className="text-h3 text-text">{step.title}</h2>
                <p className="mt-2 text-pretty text-body text-text-secondary">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-prose text-body text-text-secondary">
          Ready to see it?{" "}
          <Link
            href="/wizard"
            className="rounded-sm font-medium text-text-link underline-offset-2 hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            Estimate your footprint
          </Link>{" "}
          — every figure shown with its source before anything is saved.
        </p>
      </section>
    </div>
  );
}
