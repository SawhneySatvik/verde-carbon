"use client";

import { useId, useState } from "react";
import { m } from "motion/react";
import { EASE_OUT_QUART } from "@/app/_lib/motion";
import type { Locale, Unit } from "@core/schemas";
import { useAnnouncer } from "../../../_components/Announcer";
import { Badge } from "../../../_components/Badge";
import { Card } from "../../../_components/Card";
import { AlertTriangle, Ripple, Sparkles } from "../../../_components/icons";

/**
 * ImageLogger (image-mode log entry). The "Snap a photo"
 * surface: a real labelled file input (camera-friendly on mobile via
 * `capture="environment"`), three deterministic "Try a sample image" buttons,
 * and a preview/parsing/fallback state matrix.
 *
 * Persistence contract ("show before save"): this component NEVER persists
 * and NEVER renders a CO₂e number. It only reads the chosen/sample image →
 * base64 → POSTs /api/parse-image. On `{ fallback:false }` it hands the parsed
 * items UP to the page via `onParsed`, which drives the SAME ParseConfirmation
 * confirm phase — so the user MUST confirm before anything is logged. On
 * `{ fallback:true }` or a 413 (oversize) it calls `onFallback(reason)` with a
 * NON-BLOCKING message and keeps the image preview so the user can retry — never
 * a hard error.
 *
 * Look: the Double-Bezel `Card` material, a dashed drop/preview frame, sample
 * buttons as real ≥44px `<button>`s, and an entrance via `m`/LazyMotion
 * (transform/opacity only → reduced-motion safe through MotionConfig
 * reducedMotion="user"). A11y: a real `<label>` wired to the file input, a busy
 * status region during parse, an in-context alert for the non-blocking reason,
 * `alt` on the preview image, and announcements through the shared announcer.
 */

interface ParsedItem {
  activity: string;
  value: number;
  unit: Unit;
  candidateFactorKey: string;
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

/** The bundled, deterministic demo fixtures (hash-matched in the local adapter). */
interface Sample {
  name: string;
  context: "meal" | "receipt";
  label: string;
  description: string;
}

const SAMPLES: readonly Sample[] = [
  {
    name: "meal-beef-burger",
    context: "meal",
    label: "Beef burger meal",
    description: "A single meal photo",
  },
  {
    name: "meal-veg-bowl",
    context: "meal",
    label: "Veggie bowl meal",
    description: "A single meal photo",
  },
  {
    name: "receipt-grocery",
    context: "receipt",
    label: "Grocery receipt",
    description: "A multi-item receipt",
  },
];

const ALLOWED_MEDIA: Record<string, ImageMediaType> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

const reveal = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** Read a File / Blob into a bare base64 string (no data: prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

interface PreviewState {
  url: string;
  alt: string;
}

export function ImageLogger({
  locale = "US",
  onParsed,
  onFallback,
}: {
  locale?: Locale;
  /** Hand the parsed items to the SAME confirm phase the NL path uses. */
  onParsed: (items: ParsedItem[]) => void;
  /** Non-blocking fallback (AI fallback signal or 413 oversize). */
  onFallback: (reason: string) => void;
}) {
  const { announce } = useAnnouncer();
  const reactId = useId();

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [parsing, setParsing] = useState(false);
  // An in-context, non-blocking reason that stays beside the retained preview.
  const [reason, setReason] = useState<string | null>(null);

  const fileInputId = `image-input-${reactId}`;
  const hintId = `image-hint-${reactId}`;
  const reasonId = `image-reason-${reactId}`;

  async function parse(
    imageBase64: string,
    imageMediaType: ImageMediaType,
    context?: "meal" | "receipt",
  ) {
    setParsing(true);
    setReason(null);
    announce("Reading your photo…");
    try {
      const res = await fetch("/api/parse-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          imageMediaType,
          ...(context !== undefined && { context }),
          locale,
        }),
      });

      // 413 (oversize) is the ONE real status code — surface it as a
      // non-blocking reason, never a thrown/hard error.
      if (res.status === 413) {
        const message =
          "That image is too large to read. Try a smaller photo, or use the structured form.";
        setReason(message);
        announce(message, "assertive");
        return;
      }

      const data = (await res.json()) as
        | { fallback: false; parse: { items: ParsedItem[] } }
        | { fallback: true; reason: string; message: string };

      if (data.fallback) {
        setReason(data.message);
        announce(data.message, "assertive");
        onFallback(data.message);
        return;
      }

      const items = data.parse.items;
      announce(
        `Read ${items.length} item${items.length === 1 ? "" : "s"} from your photo. Review the breakdown before saving.`,
      );
      onParsed(items);
    } catch {
      const message =
        "We couldn't read that photo right now. Use the structured form to keep logging.";
      setReason(message);
      announce(message, "assertive");
      onFallback(message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSample(sample: Sample) {
    if (parsing) return;
    setPreview({
      url: `/samples/${sample.name}.png`,
      alt: `Sample image: ${sample.label}`,
    });
    try {
      const res = await fetch(`/samples/${sample.name}.png`);
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      await parse(base64, "image/png", sample.context);
    } catch {
      const message =
        "Couldn't load that sample image. Try another, or use the structured form.";
      setReason(message);
      announce(message, "assertive");
      onFallback(message);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later (the change event won't fire twice
    // for an identical path otherwise).
    e.target.value = "";
    if (!file) return;

    const mediaType = ALLOWED_MEDIA[file.type.toLowerCase()];
    if (!mediaType) {
      const message =
        "That file type isn't supported. Choose a JPEG, PNG, or WebP photo.";
      setReason(message);
      announce(message, "assertive");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return { url: objectUrl, alt: `Selected photo: ${file.name}` };
    });

    try {
      const base64 = await blobToBase64(file);
      await parse(base64, mediaType);
    } catch {
      const message =
        "We couldn't read that photo. Use the structured form to keep logging.";
      setReason(message);
      announce(message, "assertive");
      onFallback(message);
    }
  }

  return (
    <m.div {...reveal} transition={{ duration: 0.44, ease: EASE_OUT_QUART }}>
      <Card elevation="raised" pad="lg">
        <div className="space-y-6">
          <div>
            <Badge tone="brand" eyebrow icon={<Ripple size={13} />}>
              Snap a photo
            </Badge>
            <h2 className="mt-3 font-display text-h3 tracking-[-0.01em] text-text">
              Log from a photo
            </h2>
            <p
              id={hintId}
              className="mt-2 max-w-[54ch] text-pretty text-body-sm text-text-secondary"
            >
              Take a photo of a meal or a grocery receipt. We&rsquo;ll read the
              items and show the parsed breakdown — nothing is saved until you
              review and confirm.
            </p>
          </div>

          {/* Drop / preview frame. The whole frame is a real <label> for the
              file input, so a click or keyboard activation anywhere opens the
              picker (and, on mobile, the camera via capture). */}
          <label
            htmlFor={fileInputId}
            className="group flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border-strong bg-surface-sunken p-6 text-center transition-colors duration-fast ease-out-quart hover:border-border-interactive focus-within:border-brand focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-[--ring-offset]"
          >
            {preview ? (
              // A runtime object-URL / public sample, not a build-time asset —
              // next/image can't optimize these, so a plain <img> is correct.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.alt}
                className="max-h-48 w-auto rounded-sm object-contain shadow-xs"
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-surface text-text-secondary shadow-xs"
              >
                <Ripple size={24} />
              </span>
            )}
            <span className="text-body-sm font-medium text-text">
              {preview ? "Choose a different photo" : "Choose a photo to log"}
            </span>
            <span className="text-caption text-text-muted">
              JPEG, PNG, or WebP — tap to open your camera on mobile
            </span>
            <input
              id={fileInputId}
              name="image"
              type="file"
              accept="image/*"
              capture="environment"
              aria-describedby={hintId}
              disabled={parsing}
              onChange={handleFile}
              className="sr-only"
            />
          </label>

          {/* Parsing status — busy + textual, not color-only. */}
          {parsing && (
            <p
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-2 text-body-sm text-brand-fg"
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
              Reading your photo — nothing is saved yet.
            </p>
          )}

          {/* Non-blocking reason — an in-context alert that keeps the preview so
              the user can retry. Icon + text, never color alone. */}
          {reason && !parsing && (
            <p
              id={reasonId}
              role="alert"
              className="flex items-start gap-2 rounded-sm bg-warning-bg px-3.5 py-3 text-body-sm text-warning-fg"
            >
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{reason}</span>
            </p>
          )}

          {/* Deterministic demo: three real sample buttons. */}
          <div className="border-t border-border pt-5">
            <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.04em] text-text-muted">
              <Sparkles size={14} aria-hidden="true" />
              Try a sample image
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              No camera handy? Parse one of these bundled photos to see the
              flow.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  disabled={parsing}
                  onClick={() => handleSample(sample)}
                  className="flex min-h-[44px] flex-col items-start gap-0.5 rounded-sm border border-border-interactive bg-surface px-3.5 py-2.5 text-left transition-colors duration-fast ease-out-quart hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[--ring-offset] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-body-sm font-medium text-text">
                    {sample.label}
                  </span>
                  <span className="text-caption text-text-muted">
                    {sample.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </m.div>
  );
}
