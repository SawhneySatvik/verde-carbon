import * as React from "react";
import { FOCUS_RING } from "@/app/_lib/classNames";

/**
 * Field + Input — form primitives.
 *
 * `Field` wires a real <label> to its control and renders helper / error text,
 * associating both via `aria-describedby` / `aria-errormessage` and setting
 * `aria-invalid` when in error. The control gets a generated id when none is
 * supplied, so the label↔control link is always real (never placeholder-only).
 *
 * State matrix on the input: default · hover · :focus-visible (visible ring,
 * never `outline:none` alone) · disabled · error · loading (read-only + busy).
 * Targets are ≥44px tall. Placeholder text uses `--text-muted` (AA-measured),
 * not the washed-out gray default.
 *
 * Error semantics: the message has an id; the input points at it with
 * `aria-errormessage` and sets `aria-invalid="true"`. The error is also colored
 * AND prefixed with an icon by callers where needed — color is not the sole
 * channel.
 */

/* ------------------------------- Input ---------------------------------- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Read-only + aria-busy while an async validation/lookup runs. */
  loading?: boolean;
}

export const inputClass = (invalid?: boolean) =>
  [
    "block w-full min-h-[44px] rounded-xs px-3.5 py-2.5",
    "bg-surface text-body text-text placeholder:text-text-muted",
    "border transition-colors duration-fast ease-out-quart",
    invalid
      ? "border-danger"
      : "border-border-strong hover:border-border-interactive",
    FOCUS_RING,
    invalid ? "focus-visible:ring-danger" : "",
    "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled",
    "read-only:bg-surface-sunken",
  ]
    .filter(Boolean)
    .join(" ");

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid, loading, readOnly, className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-busy={loading || undefined}
        readOnly={readOnly || loading}
        className={[inputClass(invalid), className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);

/* ------------------------------- Field ---------------------------------- */

export interface FieldProps {
  label: React.ReactNode;
  /** Control id; auto-generated when omitted. */
  id?: string;
  /** Helper text under the control (always rendered when present). */
  hint?: React.ReactNode;
  /** Error message; when set, marks the field invalid and links it. */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  /**
   * Render the control. Receives the wired props (id, aria-describedby,
   * aria-errormessage, aria-invalid) so any control (Input, <select>, etc.)
   * stays correctly associated.
   */
  children: (controlProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-errormessage"?: string;
    "aria-invalid"?: true;
    required?: boolean;
  }) => React.ReactNode;
}

export function Field({
  label,
  id,
  hint,
  error,
  required,
  className = "",
  children,
}: FieldProps) {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}
    >
      <label htmlFor={fieldId} className="text-body-sm font-medium text-text">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children({
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-errormessage": errorId,
        "aria-invalid": error ? true : undefined,
        required,
      })}

      {hint ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
