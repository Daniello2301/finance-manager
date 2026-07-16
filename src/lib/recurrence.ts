/**
 * The date engine of recurring transactions: when a template next comes due, and
 * which occurrences are overdue right now.
 *
 * Pure, and free of Mongoose on purpose — the "próximos vencimientos" widget
 * computes this in the browser, and importing Mongoose into a client bundle has
 * already broken this build once. UTC throughout, same as `period.ts`,
 * `debt-math.ts` and `card-cycle.ts`: a due date must not depend on the server's
 * timezone. An error here doesn't crash — it returns a false date, silently
 * moving someone's money on the wrong day — which is why this is tested to 100%.
 */

import type { RecurrenceFrequency } from "@/lib/models/RecurringTransaction";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds a UTC date, clamping the day to the last of the month.
 *
 * A monthly template anchored to the 31st comes due on the 28th (or 29th) in
 * February — it does not roll into March, and it does not skip the month. Same
 * rule as `card-cycle` and `recurrence`'s own Scenario 8.
 */
function utcDay(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfMonth)));
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/** `YYYY-MM-DD` in UTC — the idempotency key of a materialised occurrence. */
export function occurrenceKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

/**
 * The due date that follows `from`.
 *
 * `anchorDay` is used for monthly/yearly and kept SEPARATE from the possibly
 * clamped date, so a template on the 31st returns to the 31st after a short
 * month rather than sticking on the 28th. Weekly/biweekly ignore it and run on a
 * fixed day cadence measured from `from`.
 */
export function nextOccurrence(
  from: Date,
  frequency: RecurrenceFrequency,
  anchorDay: number
): Date {
  const d = startOfUtcDay(from);
  switch (frequency) {
    case "weekly":
      return new Date(d.getTime() + 7 * DAY_MS);
    case "biweekly":
      return new Date(d.getTime() + 14 * DAY_MS);
    case "monthly":
      return utcDay(d.getUTCFullYear(), d.getUTCMonth() + 1, anchorDay);
    case "yearly":
      return utcDay(d.getUTCFullYear() + 1, d.getUTCMonth(), anchorDay);
  }
}

/**
 * The first occurrence on or after `today` (FR-003). Never earlier — `startDate`
 * anchors the day, it does not generate history. No backfill.
 */
export function firstDueDate(
  startDate: Date,
  frequency: RecurrenceFrequency,
  anchorDay: number,
  today: Date
): Date {
  const start = startOfUtcDay(startDate);
  const todayUtc = startOfUtcDay(today);

  let candidate: Date;
  if (frequency === "weekly" || frequency === "biweekly") {
    // The cadence runs from startDate itself.
    candidate = start;
  } else {
    // Anchor within startDate's own month, then step forward if that day has
    // already gone by relative to startDate.
    candidate = utcDay(start.getUTCFullYear(), start.getUTCMonth(), anchorDay);
    if (candidate < start) {
      candidate = nextOccurrence(candidate, frequency, anchorDay);
    }
  }

  // Advance to the first occurrence >= today. Bounded so a mistyped past
  // startDate can't spin forever; in practice startDate is today or recent.
  let guard = 0;
  while (candidate < todayUtc && guard++ < 10000) {
    candidate = nextOccurrence(candidate, frequency, anchorDay);
  }
  return candidate;
}

export interface DueOccurrencesInput {
  nextDueDate: Date;
  frequency: RecurrenceFrequency;
  anchorDay: number;
  endDate?: Date | null;
}

/**
 * Every occurrence from `nextDueDate` up to and including `today`.
 *
 * Capped, because a mistyped `nextDueDate` far in the past must not try to
 * generate hundreds of transactions — the cap turns a data error into a bounded,
 * visible backlog instead of a runaway write.
 */
export function dueOccurrences(
  recurring: DueOccurrencesInput,
  today: Date,
  cap = 60
): Date[] {
  const todayUtc = startOfUtcDay(today);
  const end = recurring.endDate ? startOfUtcDay(recurring.endDate) : null;

  const occurrences: Date[] = [];
  let due = startOfUtcDay(recurring.nextDueDate);

  while (due <= todayUtc && occurrences.length < cap) {
    if (end && due > end) break;
    occurrences.push(due);
    due = nextOccurrence(due, recurring.frequency, recurring.anchorDay);
  }
  return occurrences;
}
