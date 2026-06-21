"use client";

/**
 * The message-input form — a labelled textarea + a send Button.
 *
 * Presentational: all state, the `send()` callback, and the focus-restore effect
 * (WCAG 2.4.3) live in the parent. The textarea `ref` is FORWARDED from the
 * parent so its focus-restore effect (`inputRef.current?.focus()`) targets the
 * same node. While `busy` the textarea stays FOCUSABLE — it is `readOnly` (NOT
 * disabled) with `aria-busy`, so focus + tab order survive each round-trip.
 */

import * as React from "react";
import { Button } from "../../../_components/Button";
import { Field, inputClass } from "../../../_components/Field";
import { ArrowUpRight } from "../../../_components/icons";

export function Composer({
  id,
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSubmit,
  busy,
  disabled,
}: {
  id: string;
  inputRef: React.Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-5">
      <Field
        id={id}
        label="Ask the coach a question"
        hint="Press Enter to send · Shift + Enter for a new line"
      >
        {(controlProps) => (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              {...controlProps}
              ref={inputRef}
              rows={2}
              value={value}
              onChange={onChange}
              onKeyDown={onKeyDown}
              maxLength={2000}
              // WCAG 2.4.3: stay focusable while the request is in
              // flight. A `disabled` textarea can't hold focus, so focus
              // would drop to <body> each send and never return; `readOnly`
              // keeps focus + tab order, and `aria-busy` tells AT it's busy.
              readOnly={busy}
              aria-busy={busy}
              placeholder="e.g. What's my biggest lever right now?"
              className={`${inputClass(false)} min-h-[64px] resize-y`}
            />
            <Button
              type="submit"
              loading={busy}
              disabled={disabled}
              trailingIcon={<ArrowUpRight size={15} />}
              className="shrink-0 sm:w-auto"
            >
              {busy ? "Sending" : "Send"}
            </Button>
          </div>
        )}
      </Field>
    </form>
  );
}
