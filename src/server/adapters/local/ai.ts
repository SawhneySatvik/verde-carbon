import { createHash } from "node:crypto";
import { aiParseResultSchema, type AiParseResult } from "@core/schemas";
import type {
  AiCoachRequest,
  AiParseImageRequest,
  AiParseRequest,
  AiPhraseRequest,
  AiPort,
} from "@core/ports";
import fixturesRaw from "./fixtures/parse.json";
import imageFixturesRaw from "./fixtures/image-parse.json";
import coachFixturesRaw from "./fixtures/coach.json";

interface FixtureEntry {
  match: string;
  aliases?: string[];
  result: unknown;
}

interface FixtureFile {
  version: string;
  description?: string;
  entries: FixtureEntry[];
}

interface ImageFixtureEntry {
  sample?: string;
  sha256: string;
  context?: string;
  result: unknown;
}

interface ImageFixtureFile {
  version: string;
  description?: string;
  entries: ImageFixtureEntry[];
}

interface CoachFixtureEntry {
  match: string;
  aliases?: string[];
  reply: string;
}

interface CoachFixtureFile {
  version: string;
  description?: string;
  /** Digit-free default returned when no recorded Q&A matches the message. */
  default: string;
  entries: CoachFixtureEntry[];
}

/** Reject any digit so a recorded coach reply can never carry an AI number. */
function assertDigitFreeFixture(reply: string, key: string): string {
  if (/\d/.test(reply)) {
    throw new Error(
      `Coach fixture reply for "${key}" must not contain a number.`,
    );
  }
  return reply;
}

/** sha256 (lowercase hex) of the DECODED image bytes — the image fixture key. */
export function imageContentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Normalize NL input so equivalent phrasings hit the same fixture: lowercase,
 * trim, collapse internal whitespace, strip surrounding/trailing punctuation.
 */
export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:'"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recorded-fixture AiPort (ADR-002/006). Matches normalized NL input to a
 * recorded parse and returns a Zod-validated `AiParseResult` for deterministic,
 * network-free parse in dev + CI. Validating the FIXTURE through the same
 * schema means a malformed recording fails loudly here, not in a handler. The
 * result structurally cannot carry a CO2e number — the calculator is the sole
 * producer of emission numbers.
 */
export class RecordedAiPort implements AiPort {
  private readonly byKey: ReadonlyMap<string, AiParseResult>;
  private readonly byImageHash: ReadonlyMap<string, AiParseResult>;
  private readonly coachByKey: ReadonlyMap<string, string>;
  private readonly coachDefault: string;

  constructor(
    file: FixtureFile = fixturesRaw as FixtureFile,
    imageFile: ImageFixtureFile = imageFixturesRaw as ImageFixtureFile,
    coachFile: CoachFixtureFile = coachFixturesRaw as CoachFixtureFile,
  ) {
    const byKey = new Map<string, AiParseResult>();
    for (const entry of file.entries) {
      const validated = aiParseResultSchema.parse(entry.result);
      const keys = [entry.match, ...(entry.aliases ?? [])];
      for (const key of keys) {
        const norm = normalizeInput(key);
        if (byKey.has(norm)) {
          throw new Error(
            `Duplicate AI fixture key after normalization: "${norm}".`,
          );
        }
        byKey.set(norm, validated);
      }
    }
    this.byKey = byKey;

    // Image fixtures are keyed off the lowercase-hex sha256 of the decoded bytes.
    // Validating each recording through the SAME schema means a malformed
    // image recording fails loudly at construction, not in a handler.
    const byImageHash = new Map<string, AiParseResult>();
    for (const entry of imageFile.entries) {
      const validated = aiParseResultSchema.parse(entry.result);
      const hash = entry.sha256.toLowerCase();
      if (byImageHash.has(hash)) {
        throw new Error(`Duplicate image fixture hash: "${hash}".`);
      }
      byImageHash.set(hash, validated);
    }
    this.byImageHash = byImageHash;

    // Coach Q&A fixtures: normalized message -> digit-free canned advice. Each
    // recording is asserted digit-free at construction so a malformed reply (one
    // carrying an AI number) fails loudly here, not in the route's digit-free
    // refine — the calculator stays the sole producer of numbers (ADR-001).
    const coachByKey = new Map<string, string>();
    for (const entry of coachFile.entries) {
      const reply = assertDigitFreeFixture(entry.reply, entry.match);
      const keys = [entry.match, ...(entry.aliases ?? [])];
      for (const key of keys) {
        const norm = normalizeInput(key);
        if (coachByKey.has(norm)) {
          throw new Error(
            `Duplicate coach fixture key after normalization: "${norm}".`,
          );
        }
        coachByKey.set(norm, reply);
      }
    }
    this.coachByKey = coachByKey;
    this.coachDefault = assertDigitFreeFixture(coachFile.default, "default");
  }

  async parseActivity(request: AiParseRequest): Promise<AiParseResult> {
    const norm = normalizeInput(request.input);
    const matched = this.byKey.get(norm);
    if (matched) {
      return structuredClone(matched);
    }
    // No recording: return a safe clarification rather than inventing items.
    return aiParseResultSchema.parse({
      items: [],
      clarification: `No recorded parse for "${request.input}". Add a fixture or use the structured fallback.`,
    });
  }

  /**
   * Replay a recorded IMAGE parse. Hash the DECODED image bytes and look up
   * the fixture; a hit returns Zod-validated items, a miss returns the SAME safe
   * clarification shape the text path uses (non-blocking fallback) rather than
   * inventing items. The result structurally cannot carry a CO2e number — the
   * calculator is the sole producer of emission numbers.
   */
  async parseImage(request: AiParseImageRequest): Promise<AiParseResult> {
    const bytes = Buffer.from(request.imageBase64, "base64");
    const hash = imageContentHash(bytes);
    const matched = this.byImageHash.get(hash);
    if (matched) {
      return structuredClone(matched);
    }
    return aiParseResultSchema.parse({
      items: [],
      clarification:
        "No recorded image parse for this photo. Add a fixture (see fixtures/README.md) or use the structured fallback.",
    });
  }

  async phraseInsight(request: AiPhraseRequest): Promise<string> {
    // Deterministic neutral phrasing — never a number.
    return `Consider ${request.action}.`;
  }

  /**
   * Replay recorded coach advice. Normalizes the user's MESSAGE and looks
   * up a recorded Q&A reply; a miss returns the sensible digit-free default
   * rather than inventing advice. Deterministic and offline — never a network
   * call. The reply is digit-free by construction (every fixture is asserted
   * digit-free); the grounding `context` is supplied by the route as DATA and is
   * never echoed back, so a second-order injection in a logged string cannot
   * surface here. The calculator remains the sole producer of any number.
   */
  async coach(request: AiCoachRequest): Promise<string> {
    const norm = normalizeInput(request.message);
    return this.coachByKey.get(norm) ?? this.coachDefault;
  }
}
