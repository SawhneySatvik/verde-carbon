import type { Category } from "@core/schemas";

/** Why a coach reply degraded to neutral, digit-free advice. */
export type CoachFallbackReason =
  | "quota_exceeded"
  | "ai_unavailable"
  | "invalid_ai_output";

/**
 * Calculator-sourced figures the UI shows alongside the worded advice. Every
 * number here is computed by the deterministic calculator from the user's own
 * logs — never by the model (ADR-001).
 */
export interface CoachGrounding {
  totalKg: number;
  topCategory: Category | null;
  topInsightTitles: string[];
  activityCount: number;
}

/** Response shape of `POST /api/coach`. */
export interface CoachResponse {
  reply: string;
  fallback: boolean;
  reason?: CoachFallbackReason;
  grounding: CoachGrounding;
}

export interface UserTurn {
  id: string;
  role: "user";
  text: string;
}

export interface CoachTurn {
  id: string;
  role: "coach";
  text: string;
  fallback: boolean;
}

/** One entry in the conversation log. */
export type Turn = UserTurn | CoachTurn;
