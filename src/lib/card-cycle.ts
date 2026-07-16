/**
 * The billing cycle of a credit card: when the statement closes, when you have
 * to pay it, and how much you have to pay to avoid interest.
 *
 * Pure, and free of Mongoose on purpose — the card page computes this in the
 * browser (and importing Mongoose into a client bundle has already broken this
 * build once). UTC throughout, same as `period.ts` and `debt-math.ts`: a billing
 * date must not depend on the server's timezone.
 */

/** A card whose cycle can be computed. Both days are needed, or there is none. */
export interface CardCycleConfig {
  /** Day of the month the statement closes (1–31). */
  statementDay: number;
  /** Day of the month the payment is due (1–31). */
  paymentDay: number;
}

export interface Cycle {
  /** First day covered by this statement. */
  start: Date;
  /** The day it closes — purchases up to and including this date are on it. */
  close: Date;
  /** When it must be paid to avoid interest. */
  due: Date;
}

/**
 * Clamps to the last day of the month.
 *
 * A card that closes on the 31st closes on the 28th in February — it does not
 * roll into March, and it does not skip the month. Same rule as `recurrence`.
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

/**
 * The statement a purchase made on `date` lands on.
 *
 * Buy on the 14th with a close on the 20th → it's on the statement closing this
 * month. Buy on the 25th → you missed the close, so it's on next month's. This
 * is the whole reason people ask "if I buy today, when do I pay for it?".
 */
export function cycleFor(config: CardCycleConfig, date: Date): Cycle {
  const day = startOfUtcDay(date);
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();

  let close = utcDay(year, month, config.statementDay);
  if (day > close) {
    close = utcDay(year, month + 1, config.statementDay);
  }

  // The cycle opens the day after the previous statement closed.
  const previousClose = utcDay(
    close.getUTCFullYear(),
    close.getUTCMonth() - 1,
    config.statementDay
  );
  const start = new Date(previousClose.getTime() + 24 * 60 * 60 * 1000);

  // The payment falls after the close: if the due day is on or before the close
  // day, it belongs to the following month (close on the 20th, pay on the 5th →
  // the 5th of NEXT month).
  const dueMonth =
    config.paymentDay > config.statementDay
      ? close.getUTCMonth()
      : close.getUTCMonth() + 1;
  const due = utcDay(close.getUTCFullYear(), dueMonth, config.paymentDay);

  return { start, close, due };
}

export interface CardMovement {
  date: Date;
  amount: number;
  /** Present only on deferred purchases. */
  installmentCount?: number;
}

/**
 * What must be paid by the due date to avoid interest.
 *
 * NOT the card's balance. A 2.400.000 purchase split into 12 demands 200.000
 * this month, not 2.400.000 — even though you owe the bank the full 2.400.000
 * and your credit limit dropped by all of it the day you bought it. Two
 * different numbers, both true, and confusing them is the central error this
 * module exists to avoid.
 *
 * Instalments are rounded so they SUM BACK to the purchase: the last one absorbs
 * the remainder. Dividing 2.000.000 by 12 and rounding every instalment the same
 * way leaves the user paying a few pesos more or less than they borrowed, which
 * is exactly the kind of drift that makes a balance stop reconciling.
 */
export function amountDue(
  config: CardCycleConfig,
  movements: CardMovement[],
  asOf: Date
): number {
  // The statement being paid is the one that has already CLOSED — the one whose
  // due date is next. `cycleFor(asOf)` gives the cycle still open, so step back.
  const openCycle = cycleFor(config, asOf);
  const closed = cycleFor(
    config,
    new Date(openCycle.start.getTime() - 24 * 60 * 60 * 1000)
  );

  let total = 0;

  for (const movement of movements) {
    const bought = startOfUtcDay(movement.date);
    if (bought > closed.close) continue;

    const count = movement.installmentCount ?? 1;
    if (count === 1) {
      // A normal purchase is only on ONE statement: the one it fell in.
      if (bought >= closed.start) total += movement.amount;
      continue;
    }

    // A deferred purchase pays one instalment per statement, starting with the
    // one it fell in. Which instalment is due now?
    const purchaseCycle = cycleFor(config, bought);
    const index = monthsBetween(purchaseCycle.close, closed.close);
    if (index < 0 || index >= count) continue;

    total += installment(movement.amount, count, index);
  }

  return total;
}

/** Whole months between two statement closes. */
function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

/**
 * Instalment `index` (0-based) of `amount` split `count` ways.
 * The last one absorbs the rounding remainder, so they sum back exactly.
 */
export function installment(
  amount: number,
  count: number,
  index: number
): number {
  const base = Math.floor(amount / count);
  return index === count - 1 ? amount - base * (count - 1) : base;
}
