/**
 * Shared USER-LOCALE day-boundary helper. The AI-quota daily rollover and
 * the streak day rule MUST agree on what "today" is, so both import this
 * single source of truth. A day key is the local calendar date in the user's IANA
 * time zone — NOT the UTC date — so a midnight / DST boundary is computed once and
 * consistently.
 */

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidTimeZoneError extends Error {
  constructor(timeZone: string) {
    super(`Invalid IANA time zone: "${timeZone}".`);
    this.name = "InvalidTimeZoneError";
  }
}

/**
 * The `YYYY-MM-DD` calendar date of `date` as observed in `timeZone`. Uses
 * `Intl.DateTimeFormat` with `en-CA` (which formats as `YYYY-MM-DD`) so the
 * result is timezone-correct across DST transitions and matches the
 * `Streak.lastLoggedDate` shape. Throws on an unknown time zone rather than
 * silently falling back to UTC, so a misconfigured locale never quietly skews
 * the quota-reset / streak boundary.
 */
export function localeDayKey(date: Date, timeZone: string): string {
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    throw new InvalidTimeZoneError(timeZone);
  }
  if (!DAY_KEY_RE.test(formatted)) {
    throw new InvalidTimeZoneError(timeZone);
  }
  return formatted;
}

export function isDayKey(value: string): boolean {
  return DAY_KEY_RE.test(value);
}
