/**
 * The arithmetic behind Deudas.
 *
 * Pure functions, no Mongoose — DebtForm.tsx is a client component and needs
 * `deriveMonthlyRate` to show the solved rate as the user types; importing
 * mongoose into the browser bundle broke the build once already in this repo.
 *
 * Every amount is an integer in minor units (COP has a zero exponent, so:
 * whole pesos) per Principle 9. `monthlyRate` is NOT money — it's a decimal
 * fraction, 0.015 for 1.5% a month.
 */

export interface DebtInput {
  principal?: number;
  monthlyRate?: number;
  installmentAmount?: number;
  installmentCount?: number;
  startDate?: Date;
}

export interface DebtPayment {
  amount: number;
  date: Date;
}

export interface SplitPayment extends DebtPayment {
  /** null when there's no basis to compute it (no principal, or no rate). */
  interest: number | null;
  principal: number | null;
  /** false when this month's payments didn't cover this month's interest. */
  coversInterest: boolean;
}

export interface DebtState {
  /**
   * null means "we don't know" — not "you owe nothing". Showing 0 here when the
   * user simply never entered a principal would be the worst bug this module
   * could have.
   */
  outstanding: number | null;
  /** Interest that fell due and wasn't paid. Never capitalized (see below). */
  arrears: number;
  totalPaid: number;
  totalToInterest: number;
  totalToPrincipal: number;
  payments: SplitPayment[];
  underpaid: boolean;
  monthlyInterest: number | null;
}

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-9;
/** Above this, we're not solving a loan, we're reporting a typo. */
const MAX_PLAUSIBLE_MONTHLY_RATE = 1;

/**
 * Solves `installment = P·i / (1 − (1+i)^−n)` for `i`.
 *
 * There's no closed form, so: Newton-Raphson with a numeric (secant) derivative
 * — deriving it by hand is a good way to introduce a silent sign error.
 *
 * Returns null, deliberately and often. All three inputs are required: with only
 * two, the equation has two unknowns and any number we produced would be
 * invented. It also returns null when no positive rate can explain the numbers
 * (paying back less than you borrowed) or when the answer is absurd — saying
 * "I can't" beats dressing up a wrong figure as a fact.
 */
export function deriveMonthlyRate(
  principal?: number,
  installment?: number,
  count?: number
): number | null {
  if (!principal || !installment || !count) return null;
  if (principal <= 0 || installment <= 0 || count <= 0) return null;

  const totalRepaid = installment * count;

  // You'd never finish paying: no positive rate satisfies this.
  if (totalRepaid < principal) return null;

  // Exactly repaying the principal means no interest at all — common for BNPL
  // instalment plans. Newton-Raphson can't find this one (i=0 makes the
  // expression 0/0), so it's returned directly.
  if (totalRepaid === principal) return 0;

  const f = (i: number): number =>
    (principal * i) / (1 - Math.pow(1 + i, -count)) - installment;

  let rate = 0.01; // 1% a month. Starting at 0 would be indeterminate.

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const value = f(rate);
    if (Math.abs(value) < TOLERANCE) break;

    const step = rate * 1e-6 || 1e-9;
    const slope = (f(rate + step) - value) / step;
    if (!Number.isFinite(slope) || slope === 0) return null;

    const next = rate - value / slope;
    if (!Number.isFinite(next)) return null;
    // Keep the search in territory where the formula is defined.
    rate = Math.min(Math.max(next, TOLERANCE), MAX_PLAUSIBLE_MONTHLY_RATE * 2);
  }

  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (rate > MAX_PLAUSIBLE_MONTHLY_RATE) return null;
  if (Math.abs(f(rate)) > 1) return null; // didn't actually converge

  return rate;
}

/**
 * The one place that decides what rate a debt runs at.
 *
 * `estimated` is load-bearing: it's what keeps the UI from presenting a number
 * we solved for as though it came off the user's contract.
 */
export function effectiveRate(
  debt: DebtInput
): { rate: number; estimated: boolean } | null {
  if (debt.monthlyRate !== undefined && debt.monthlyRate !== null) {
    return { rate: debt.monthlyRate, estimated: false };
  }

  const derived = deriveMonthlyRate(
    debt.principal,
    debt.installmentAmount,
    debt.installmentCount
  );
  if (derived === null) return null;

  return { rate: derived, estimated: true };
}

/** "YYYY-MM" in UTC. */
function monthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/** Every month key from `from` to `to` inclusive, in UTC. */
function monthsBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
  );
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/**
 * Replays the debt month by month and reports where it stands.
 *
 * Each month: interest accrues on the outstanding balance, that month's payments
 * are pooled, interest is taken out of them first, and whatever is left goes to
 * the principal.
 *
 * Interest that isn't paid becomes arrears and is **not** added to the principal
 * (ratified 2026-07-13). Most real lenders would capitalize it; the owner's
 * doesn't. Capitalizing would overstate their debt, and dropping the shortfall
 * silently would understate it — so the principal stays put and the arrears are
 * carried alongside, in the open.
 *
 * Rounding happens every month rather than at the end: COP has no cents, and
 * deferring the rounding lets residue accumulate until the balance no longer
 * agrees with the sum of the payments — two numbers on screen that don't add up.
 */
export function replayDebt(
  debt: DebtInput,
  payments: DebtPayment[],
  asOf: Date = new Date()
): DebtState {
  const sorted = [...payments].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const totalPaid = sorted.reduce((sum, payment) => sum + payment.amount, 0);

  const rate = effectiveRate(debt);

  // No principal, or no rate: we can still report what was paid, but any
  // interest/principal split — and any outstanding balance — would be invented.
  if (!debt.principal || rate === null) {
    return {
      outstanding: null,
      arrears: 0,
      totalPaid,
      totalToInterest: 0,
      totalToPrincipal: 0,
      monthlyInterest: null,
      underpaid: false,
      payments: sorted.map((payment) => ({
        ...payment,
        interest: null,
        principal: null,
        coversInterest: true,
      })),
    };
  }

  const paymentsByMonth = new Map<string, DebtPayment[]>();
  for (const payment of sorted) {
    const key = monthKey(payment.date);
    const bucket = paymentsByMonth.get(key);
    if (bucket) bucket.push(payment);
    else paymentsByMonth.set(key, [payment]);
  }

  const start = debt.startDate ?? sorted[0]?.date ?? asOf;

  let outstanding = debt.principal;
  let arrears = 0;
  let totalToInterest = 0;
  let totalToPrincipal = 0;
  let underpaid = false;
  const split: SplitPayment[] = [];

  for (const key of monthsBetween(start, asOf)) {
    const monthInterest = Math.round(outstanding * rate.rate);
    const monthPayments = paymentsByMonth.get(key) ?? [];
    const monthPaid = monthPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const interestCovered = Math.min(monthPaid, monthInterest);
    const toPrincipal = monthPaid - interestCovered;
    const shortfall = monthInterest - interestCovered;

    if (shortfall > 0) {
      arrears += shortfall;
      // A month with no payment at all is a month that didn't cover its
      // interest, even though there's no payment to point at.
      underpaid = true;
    }

    totalToInterest += interestCovered;
    totalToPrincipal += toPrincipal;
    outstanding = Math.max(0, outstanding - toPrincipal);

    // Attribute the month's split back across its individual payments, so each
    // one can be shown broken down. Interest is taken from the earliest payments
    // first — the same order the money actually arrived.
    let interestLeft = interestCovered;
    for (const payment of monthPayments) {
      const interest = Math.min(payment.amount, interestLeft);
      interestLeft -= interest;
      split.push({
        ...payment,
        interest,
        principal: payment.amount - interest,
        coversInterest: monthPaid >= monthInterest,
      });
    }
  }

  return {
    outstanding,
    arrears,
    totalPaid,
    totalToInterest,
    totalToPrincipal,
    monthlyInterest: Math.round(outstanding * rate.rate),
    underpaid,
    payments: split,
  };
}

/**
 * A monthly rate is STORED as a fraction (0.015) and TYPED as a percentage
 * (1.5). Confusing the two is an error of two orders of magnitude on somebody's
 * real money, so the conversion lives here, once, rather than being written out
 * wherever a rate happens to be read or written.
 *
 * The Zod schema additionally rejects `monthlyRate > 1` as a safety net.
 */
export function percentToRate(percent: number): number {
  return percent / 100;
}

export function rateToPercent(rate: number): number {
  return rate * 100;
}
