"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle } from "../../../_components/icons";

/**
 * Accessible confirm dialog, focus-trapped WITHIN the dialog only and returning
 * focus on close. Modal `role="dialog"` with `aria-modal`,
 * labelled by title + described by body. Esc cancels; Tab is trapped inside;
 * focus is moved to the dialog on open and RESTORED to the opener on close.
 *
 * The message states exactly what happens to the data before proceeding
 * (destructive-action contract). Confirm/cancel are real buttons.
 *
 * The look: a tinted scrim, the Double-Bezel card material for the
 * panel (outer shell + concentric inner core), the AlertTriangle icon, and a
 * soft `rise-in` settle. The focus-trap model, Esc
 * handling, focus-on-confirm + focus-return, semantic z-index, and ≥44px targets
 * are all UNCHANGED — the buttons stay native <button>s so the trap's focusable
 * query and the confirm ref behave exactly as before.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reactId = useId();
  const titleId = `dlg-title-${reactId}`;
  const bodyId = `dlg-body-${reactId}`;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    confirmRef.current?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, []);

  function focusableEls(): HTMLElement[] {
    const root = dialogRef.current;
    if (!root) {
      return [];
    }
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab") {
      return;
    }
    const els = focusableEls();
    if (els.length === 0) {
      return;
    }
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-backdrop flex items-center justify-center bg-text/40 p-4 motion-safe:animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      {/* Outer shell — the Double-Bezel machined tray. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        className="z-modal w-full max-w-md rounded-2xl bg-[--bezel-shell] p-1.5 shadow-lg ring-1 ring-[--bezel-ring] motion-safe:animate-rise-in"
      >
        {/* Inner core — concentric (24px − 6px = 18px), soft top edge. */}
        <div className="rounded-bezel-inner bg-surface p-6 shadow-bezel-inner">
          <h2
            id={titleId}
            className={`flex items-center gap-2 font-display text-h3 ${destructive ? "text-danger-fg" : "text-text"}`}
          >
            {destructive && (
              <AlertTriangle
                size={22}
                className="shrink-0"
                aria-hidden="true"
              />
            )}
            {title}
          </h2>
          <p
            id={bodyId}
            className="mt-2.5 text-pretty text-body text-text-secondary"
          >
            {body}
          </p>
          <div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-border-interactive bg-surface px-5 py-2.5 text-body font-medium text-text-link transition-colors duration-fast ease-out-quart hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset]"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-sm px-6 py-2.5 text-body font-medium text-text-onbrand shadow-xs transition-colors duration-fast ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] ${
                destructive
                  ? "bg-danger hover:bg-danger/90"
                  : "bg-brand hover:bg-brand-hover"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
