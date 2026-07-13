import { describe, expect, it } from "vitest";
import {
  deriveMonthlyRate,
  effectiveRate,
  replayDebt,
  type DebtInput,
  type DebtPayment,
} from "@/lib/debt-math";

/**
 * This is the file that matters in the Deudas module.
 *
 * A bug here doesn't crash anything — it quietly hands the user a false number
 * about their own money, which is worse. So the cases below are the owner's real
 * debts, with figures worked out by hand, written before the implementation
 * existed.
 *
 * Amounts are COP: integer minor units with a zero exponent, i.e. whole pesos
 * (Principle 9 + money.ts).
 */

// 17.000.000 at 1.5% a month. Interest = 255.000/month.
const LOAN: DebtInput = {
  principal: 17_000_000,
  monthlyRate: 0.015,
  startDate: new Date("2026-01-01T00:00:00.000Z"),
};

function pay(date: string, amount: number): DebtPayment {
  return { date: new Date(`${date}T00:00:00.000Z`), amount };
}

/**
 * "Today", passed in explicitly rather than read from the clock — otherwise
 * these tests would change behaviour every month.
 *
 * Semantics worth being precise about, because they're easy to get subtly wrong:
 * interest is charged for **every calendar month the debt is alive, including
 * the one we're currently in**. That's how a loan at "1.5% a month" actually
 * works — the month you're in is a month you're holding the money, and its
 * interest is what the monthly payment is for.
 *
 * So `asOf` must sit inside the last month you mean to charge. End-of-January
 * charges January. The 1st of February would charge January *and* February.
 */
const AS_OF = new Date("2026-01-31T00:00:00.000Z");

describe("replayDebt", () => {
  it("charges interest on the principal before any payment is made", () => {
    const state = replayDebt(LOAN, [], AS_OF);
    expect(state.outstanding).toBe(17_000_000);
    expect(state.arrears).toBe(255_000); // one month accrued, nothing paid
    expect(state.underpaid).toBe(true);
  });

  // Scenario 2 of the spec.
  it("splits an interest-only payment into all interest and no principal", () => {
    const state = replayDebt(LOAN, [pay("2026-01-15", 255_000)], AS_OF);

    expect(state.payments).toHaveLength(1);
    expect(state.payments[0].interest).toBe(255_000);
    expect(state.payments[0].principal).toBe(0);

    // The debt has not moved. This is the whole point: paying "the interest"
    // every month forever leaves you owing exactly what you started with.
    expect(state.outstanding).toBe(17_000_000);
    expect(state.arrears).toBe(0);
    expect(state.underpaid).toBe(false);
    expect(state.totalToInterest).toBe(255_000);
    expect(state.totalToPrincipal).toBe(0);
  });

  // Scenario 3 — the owner's actual situation, and the reason this module exists.
  it("flags a payment that does not even cover the month's interest", () => {
    const state = replayDebt(LOAN, [pay("2026-01-15", 210_000)], AS_OF);

    expect(state.payments[0].interest).toBe(210_000);
    expect(state.payments[0].principal).toBe(0);
    expect(state.payments[0].coversInterest).toBe(false);

    // 255.000 owed in interest, 210.000 paid → 45.000 short.
    expect(state.arrears).toBe(45_000);
    expect(state.underpaid).toBe(true);

    // Ratified decision (2026-07-13): the shortfall is NOT capitalized. The
    // principal must not grow to 17.045.000 — the arrears carry it instead.
    expect(state.outstanding).toBe(17_000_000);
  });

  // Scenario 4.
  it("puts everything above the interest towards the principal", () => {
    const state = replayDebt(LOAN, [pay("2026-01-15", 3_000_000)], AS_OF);

    expect(state.payments[0].interest).toBe(255_000);
    expect(state.payments[0].principal).toBe(2_745_000);
    expect(state.outstanding).toBe(14_255_000);
    expect(state.arrears).toBe(0);
  });

  it("charges next month's interest on the reduced balance", () => {
    const state = replayDebt(
      LOAN,
      [pay("2026-01-15", 3_000_000), pay("2026-02-15", 213_825)],
      new Date("2026-02-28T00:00:00.000Z")
    );

    // 14.255.000 × 1.5% = 213.825 — the interest fell because the debt did.
    expect(state.payments[1].interest).toBe(213_825);
    expect(state.payments[1].principal).toBe(0);
    expect(state.outstanding).toBe(14_255_000);
    expect(state.arrears).toBe(0);
  });

  it("adds up several payments in the same month before splitting them", () => {
    const state = replayDebt(
      LOAN,
      [pay("2026-01-05", 100_000), pay("2026-01-20", 155_000)],
      AS_OF
    );

    // 100k + 155k = 255k = exactly the month's interest. Split against the
    // month's total, not payment by payment — otherwise the first 100k would
    // look like an underpayment when it was only half of one.
    expect(state.arrears).toBe(0);
    expect(state.underpaid).toBe(false);
    expect(state.totalToInterest).toBe(255_000);
  });

  it("never lets the outstanding balance go below zero", () => {
    const state = replayDebt(
      { principal: 500_000, monthlyRate: 0.01, startDate: LOAN.startDate },
      [pay("2026-01-15", 900_000)],
      AS_OF
    );
    expect(state.outstanding).toBe(0);
  });

  // The single most dangerous confusion in this module.
  it("returns null — not zero — when there is no principal to work from", () => {
    const state = replayDebt(
      { monthlyRate: 0.015, startDate: LOAN.startDate },
      [pay("2026-01-15", 210_000)],
      AS_OF
    );

    // `0` would tell the user they owe nothing. `null` says we don't know.
    expect(state.outstanding).toBeNull();
    expect(state.payments[0].interest).toBeNull();
    expect(state.payments[0].principal).toBeNull();

    // What we CAN say without a principal, we still say.
    expect(state.totalPaid).toBe(210_000);
  });

  it("returns null when there is a principal but no usable rate", () => {
    const state = replayDebt(
      { principal: 5_000_000, startDate: LOAN.startDate },
      [pay("2026-01-15", 200_000)],
      AS_OF
    );
    expect(state.outstanding).toBeNull();
    expect(state.totalPaid).toBe(200_000);
  });

  // COP has no cents, so every step rounds. If the rounding drifts, the balance
  // stops agreeing with the payments — the user sees two numbers that don't add
  // up and stops trusting the app.
  it("keeps the arithmetic exact: principal paid == drop in the balance", () => {
    const payments = [
      pay("2026-01-15", 333_333),
      pay("2026-02-15", 777_777),
      pay("2026-03-15", 1_234_567),
    ];
    const state = replayDebt(
      { principal: 10_000_001, monthlyRate: 0.0137, startDate: LOAN.startDate },
      payments,
      new Date("2026-03-31T00:00:00.000Z")
    );

    const drop = 10_000_001 - (state.outstanding ?? 0);
    expect(state.totalToPrincipal).toBe(drop);
    expect(Number.isInteger(state.outstanding)).toBe(true);
    expect(Number.isInteger(state.totalToInterest)).toBe(true);
  });

  // Transaction.date is built from "YYYY-MM-DD", which the JS spec parses as
  // UTC midnight. Local-time month arithmetic already caused a real bug in this
  // repo (transactions near a month boundary landing in the wrong month).
  it("buckets payments by UTC month, so the 31st doesn't slip into the next one", () => {
    const state = replayDebt(
      LOAN,
      [pay("2026-01-31", 255_000)],
      new Date("2026-01-31T00:00:00.000Z")
    );
    // If the 31st leaked into February, January would show as unpaid.
    expect(state.arrears).toBe(0);
    expect(state.underpaid).toBe(false);
  });
});

describe("deriveMonthlyRate", () => {
  // The owner's bank loan: knows the instalment and the term, not the rate.
  it("solves for the rate when principal, instalment and term are all known", () => {
    const rate = deriveMonthlyRate(10_000_000, 500_000, 24);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0.014);
    expect(rate!).toBeLessThan(0.017);
  });

  it("round-trips: the rate it derives reproduces the instalment it was given", () => {
    const principal = 10_000_000;
    const count = 24;
    const rate = deriveMonthlyRate(principal, 500_000, count)!;

    // installment = P·i / (1 − (1+i)^−n)
    const installment =
      (principal * rate) / (1 - Math.pow(1 + rate, -count));
    expect(Math.round(installment)).toBeCloseTo(500_000, -1);
  });

  it.each([
    ["no principal", undefined, 500_000, 24],
    ["no instalment", 10_000_000, undefined, 24],
    ["no term", 10_000_000, 500_000, undefined],
  ])("returns null with %s — two unknowns, one equation", (_label, p, i, n) => {
    expect(deriveMonthlyRate(p, i, n)).toBeNull();
  });

  // If you pay 300k × 24 = 7.2M on a 10M loan, no positive rate explains it.
  // Better to say so than to hand back a negative rate dressed up as a fact.
  it("returns null when the payments never repay the principal", () => {
    expect(deriveMonthlyRate(10_000_000, 300_000, 24)).toBeNull();
  });

  it("returns null for an absurd rate rather than an absurd number", () => {
    // 24 payments of 9M against a 1M loan implies a monstrous rate.
    const rate = deriveMonthlyRate(1_000_000, 9_000_000, 24);
    expect(rate).toBeNull();
  });

  it("handles a zero-interest instalment plan (P = cuota × n)", () => {
    // Common for BNPL: 6 payments of 100k on a 600k purchase. Rate is 0.
    const rate = deriveMonthlyRate(600_000, 100_000, 6);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0, 5);
  });
});

describe("effectiveRate", () => {
  it("prefers the rate the user actually gave us", () => {
    const result = effectiveRate({
      principal: 10_000_000,
      monthlyRate: 0.02,
      installmentAmount: 500_000,
      installmentCount: 24,
    });
    expect(result).toEqual({ rate: 0.02, estimated: false });
  });

  it("derives the rate when it wasn't given, and says so", () => {
    const result = effectiveRate({
      principal: 10_000_000,
      installmentAmount: 500_000,
      installmentCount: 24,
    });
    expect(result).not.toBeNull();
    // `estimated` is what stops a derived figure being shown as if it came from
    // the contract.
    expect(result!.estimated).toBe(true);
    expect(result!.rate).toBeGreaterThan(0.014);
  });

  it("returns null when the rate is neither known nor derivable", () => {
    expect(effectiveRate({ installmentAmount: 500_000 })).toBeNull();
    expect(effectiveRate({ principal: 10_000_000 })).toBeNull();
  });
});
