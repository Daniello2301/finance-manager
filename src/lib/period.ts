/**
 * Shared "YYYY-MM" period-key helpers. Client-safe (no mongoose import —
 * unlike src/lib/services/budgets.ts, this file is imported directly by
 * client components).
 *
 * Deliberately UTC-based, not the runtime's local timezone: `Transaction.date`
 * is always created from a date-only string (`new Date("YYYY-MM-DD")`), which
 * the JS spec parses as UTC midnight regardless of the browser's or server's
 * local timezone. Computing period keys with local-time `Date` methods
 * (`getFullYear`/`getMonth`) would silently disagree with how transactions
 * are actually dated whenever the runtime's local timezone isn't UTC —
 * dropping transactions near a month boundary from aggregations, or making
 * the server and the browser disagree about what "this month" is.
 */

function formatPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "YYYY-MM" for the current UTC calendar month. */
export function getCurrentPeriodKey(): string {
  const now = new Date();
  return formatPeriodKey(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

/** The last `months` period keys ending at the current UTC month, oldest first. */
export function getLastPeriodKeys(months: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    keys.push(formatPeriodKey(date.getUTCFullYear(), date.getUTCMonth() + 1));
  }
  return keys;
}
