import { z } from "zod";
import { MAX_QUANTITY, unitSchema } from "./domain";

export const aiParseItemSchema = z
  .object({
    activity: z.string().min(1).max(200),
    value: z.number().finite().positive().max(MAX_QUANTITY),
    unit: unitSchema,
    candidateFactorKey: z.string().min(1).max(120),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict();
export type AiParseItem = z.infer<typeof aiParseItemSchema>;

export const aiParseResultSchema = z
  .object({
    items: z.array(aiParseItemSchema).max(50),
    clarification: z.string().min(1).max(500).optional(),
  })
  .strict();
export type AiParseResult = z.infer<typeof aiParseResultSchema>;

/** Allowed inline image media types for the image parse. */
export const aiImageMediaTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export type AiImageMediaType = z.infer<typeof aiImageMediaTypeSchema>;

/**
 * Request shape for {@link AiPort.parseImage}. `imageBase64` is the
 * base64-encoded image bytes (the byte-size cap is enforced on the DECODED bytes
 * by the route, not here). `context` lets the adapter lean meal- vs
 * receipt-shaped; the RESULT reuses the existing no-CO2e `aiParseResultSchema`.
 * The upper bound on the base64 string is a coarse guardrail so a malformed body
 * can't allocate unboundedly before the route's exact decoded-byte cap runs.
 */
export const MAX_IMAGE_BASE64_CHARS = 14_000_000; // ~10 MiB decoded, coarse upper bound
export const aiParseImageRequestSchema = z
  .object({
    imageBase64: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
    imageMediaType: aiImageMediaTypeSchema,
    context: z.enum(["meal", "receipt"]).optional(),
    locale: z.string().min(1).max(40).optional(),
    maxOutputTokens: z.number().int().positive().max(4096).optional(),
  })
  .strict();
export type AiParseImageRequest = z.infer<typeof aiParseImageRequestSchema>;

/**
 * Hard upper bound on the coach `message` length. The route also enforces
 * the exact shared AI-input char cap before any model call; this is the schema
 * guardrail so a malformed body can't allocate unboundedly first.
 */
export const MAX_COACH_MESSAGE_CHARS = 2_000;

/**
 * Request shape for {@link AiPort.coach}. The `context` carries ONLY the
 * calculator-sourced, app-computed grounding numbers (totals, top category, top
 * insight titles) — the model answers from these and the coach text it returns
 * is DIGIT-FREE; every number the UI shows comes from the calculator, never the
 * model. `message` is bounded; the route caps it to the shared AI-input limit
 * before any model call. Free-text titles are treated as DATA, never as
 * instructions (second-order-injection-safe).
 */
export const aiCoachContextSchema = z
  .object({
    totalKgToDate: z.number().finite().nonnegative().optional(),
    topCategory: z.string().min(1).max(60).optional(),
    topInsightTitles: z.array(z.string().min(1).max(200)).max(3).optional(),
  })
  .strict();
export type AiCoachContext = z.infer<typeof aiCoachContextSchema>;

export const aiCoachRequestSchema = z
  .object({
    message: z.string().min(1).max(MAX_COACH_MESSAGE_CHARS),
    context: aiCoachContextSchema.optional(),
    locale: z.string().min(1).max(40).optional(),
    maxOutputTokens: z.number().int().positive().max(4096).optional(),
  })
  .strict();
export type AiCoachRequest = z.infer<typeof aiCoachRequestSchema>;
