// The image-request types live alongside their Zod schema in
// `schemas/ai-parse.schema.ts` (the single source of truth). Re-export them here
// so consumers can keep importing them from `@core/ports` next to AiPort.
import type {
  AiCoachRequest,
  AiParseImageRequest,
  AiParseResult,
} from "@core/schemas";
export type { AiImageMediaType, AiParseImageRequest } from "@core/schemas";
export type { AiCoachContext, AiCoachRequest } from "@core/schemas";

export interface AiParseRequest {
  input: string;
  locale?: string;
  maxOutputTokens?: number;
}

export interface AiPhraseRequest {
  action: string;
  context: string;
  maxOutputTokens?: number;
}

export interface AiPort {
  /**
   * Parse natural language into the strict, Zod-validated parse shape. The result
   * structurally cannot carry a CO2e number (ADR-001); the calculator is the sole
   * producer of emission numbers. Implementations re-validate with the Zod schema.
   */
  parseActivity(request: AiParseRequest): Promise<AiParseResult>;

  /**
   * Parse a meal/receipt IMAGE into the SAME strict, Zod-validated parse shape as
   * {@link parseActivity}. The result reuses {@link AiParseResult} and so
   * structurally cannot carry a CO2e number — image AI proposes candidate factor
   * keys + quantities only; the calculator remains the sole producer of emission
   * numbers. Implementations re-validate with the Zod schema and strip any stray
   * numeric/emission field a multimodal model might add.
   */
  parseImage(request: AiParseImageRequest): Promise<AiParseResult>;

  /**
   * Optional neutral phrasing for an insight. Returns text only — never a number.
   * Callers degrade to a neutral default if this fails.
   */
  phraseInsight(request: AiPhraseRequest): Promise<string>;

  /**
   * Conversational coach. Answers a user's question using ONLY the
   * app-supplied, calculator-sourced grounding {@link AiCoachRequest.context}.
   * Returns DIGIT-FREE advice text — the model NEVER emits a number; every factual
   * figure the UI shows comes from the calculator (ADR-001). The user's message
   * and any re-fed logged free text are DATA, never instructions
   * (second-order-injection-safe). Callers Zod-validate the reply is non-empty and
   * digit-free and degrade to a neutral-advice fallback on any failure.
   */
  coach(request: AiCoachRequest): Promise<string>;
}
