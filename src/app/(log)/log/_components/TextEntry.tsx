"use client";

import { Button } from "../../../_components/Button";
import { Card } from "../../../_components/Card";
import { Field } from "../../../_components/Field";
import { ArrowUpRight } from "../../../_components/icons";

/**
 * Text-mode entry card: the NL textarea, the "See the breakdown" parse button,
 * the "use the structured form instead" link, and the in-flight parsing spinner.
 */
export function TextEntry({
  text,
  onTextChange,
  parsing,
  onParse,
  onUseStructured,
}: {
  text: string;
  onTextChange: (value: string) => void;
  parsing: boolean;
  onParse: (e: React.FormEvent) => void;
  onUseStructured: () => void;
}) {
  return (
    <Card elevation="raised" pad="lg">
      <form onSubmit={onParse} className="space-y-5">
        <Field
          label="Describe your activity"
          id="nl-input"
          hint="Mention what you did, how much, and the unit — e.g. distance, meals, energy used."
        >
          {(controlProps) => (
            <textarea
              {...controlProps}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              rows={3}
              placeholder="e.g. drove 20 km to work and had a beef burger"
              disabled={parsing}
              className="block w-full resize-y rounded-xs border border-border-strong bg-surface px-3.5 py-3 text-body-lg text-text placeholder:text-text-muted transition-colors duration-fast ease-out-quart hover:border-border-interactive focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
            />
          )}
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            loading={parsing}
            disabled={text.trim() === ""}
            trailingIcon={<ArrowUpRight size={18} />}
          >
            {parsing ? "Parsing…" : "See the breakdown"}
          </Button>
          <button
            type="button"
            onClick={onUseStructured}
            className="inline-flex min-h-[44px] items-center rounded-sm px-2 text-body-sm font-medium text-text-link underline-offset-2 transition-colors duration-fast ease-out-quart hover:text-text-link-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
          >
            Use the structured form instead
          </button>
        </div>
      </form>

      {parsing && (
        <p
          role="status"
          className="mt-5 inline-flex items-center gap-2 text-body-sm text-brand-fg"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 motion-safe:animate-spin"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
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
          Parsing your activity — nothing is saved yet.
        </p>
      )}
    </Card>
  );
}
