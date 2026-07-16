import { describe, expect, it } from "vitest";

import { amountDue, cycleFor, installment } from "@/lib/card-cycle";

/** Close on the 20th, pay on the 5th — the shape of a normal Colombian card. */
const CARD = { statementDay: 20, paymentDay: 5 };

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("cycleFor", () => {
  // The question people actually ask a credit card: if I buy today, when do I
  // pay for it?
  it("a purchase before the close is on this month's statement", () => {
    const cycle = cycleFor(CARD, utc("2026-07-14"));

    expect(iso(cycle.close)).toBe("2026-07-20");
    expect(iso(cycle.due)).toBe("2026-08-05");
  });

  it("a purchase after the close falls to next month's statement", () => {
    const cycle = cycleFor(CARD, utc("2026-07-25"));

    expect(iso(cycle.close)).toBe("2026-08-20");
    expect(iso(cycle.due)).toBe("2026-09-05");
  });

  it("a purchase ON the close day is still on that statement", () => {
    const cycle = cycleFor(CARD, utc("2026-07-20"));
    expect(iso(cycle.close)).toBe("2026-07-20");
  });

  it("the cycle opens the day after the previous close", () => {
    const cycle = cycleFor(CARD, utc("2026-07-14"));
    expect(iso(cycle.start)).toBe("2026-06-21");
  });

  // A card that closes on the 31st closes on the 28th in February. It does not
  // roll into March, and it does not skip the month.
  it("clamps the close to the last day of a short month", () => {
    const cycle = cycleFor({ statementDay: 31, paymentDay: 15 }, utc("2026-02-10"));
    expect(iso(cycle.close)).toBe("2026-02-28");
  });

  it("clamps to 29 in a leap year", () => {
    const cycle = cycleFor({ statementDay: 31, paymentDay: 15 }, utc("2028-02-10"));
    expect(iso(cycle.close)).toBe("2028-02-29");
  });

  // A due day AFTER the close day belongs to the same month, not the next one.
  it("keeps the due date in the same month when it falls after the close", () => {
    const cycle = cycleFor({ statementDay: 5, paymentDay: 25 }, utc("2026-07-03"));

    expect(iso(cycle.close)).toBe("2026-07-05");
    expect(iso(cycle.due)).toBe("2026-07-25");
  });

  it("rolls the year over correctly", () => {
    const cycle = cycleFor(CARD, utc("2026-12-25"));

    expect(iso(cycle.close)).toBe("2027-01-20");
    expect(iso(cycle.due)).toBe("2027-02-05");
  });
});

describe("installment", () => {
  // If the instalments don't sum back to the purchase, the balance stops
  // reconciling — the user ends up owing a few pesos that came from nowhere.
  it("splits so the instalments sum back to the purchase exactly", () => {
    const amount = 2_000_000;
    const count = 12;

    const total = Array.from({ length: count }, (_, i) =>
      installment(amount, count, i)
    ).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(amount);
  });

  it("puts the remainder on the last instalment, not on every one", () => {
    expect(installment(100, 3, 0)).toBe(33);
    expect(installment(100, 3, 1)).toBe(33);
    expect(installment(100, 3, 2)).toBe(34);
  });
});

describe("amountDue", () => {
  // The heart of the module. The statement demands ONE instalment, not the whole
  // purchase — even though the card's balance (and your credit limit) took the
  // whole hit the day you bought it.
  it("charges one instalment of a deferred purchase, not the whole thing", () => {
    // Bought 2.400.000 in 12 on 10 July → on the statement closing 20 July,
    // which is paid on 5 August. On 25 July that statement has closed.
    const due = amountDue(
      CARD,
      [
        { date: utc("2026-07-10"), amount: 300_000 },
        { date: utc("2026-07-10"), amount: 2_400_000, installmentCount: 12 },
      ],
      utc("2026-07-25")
    );

    expect(due).toBe(300_000 + 200_000);
  });

  it("keeps charging an instalment on later statements", () => {
    const movements = [
      { date: utc("2026-07-10"), amount: 2_400_000, installmentCount: 12 },
    ];

    // Second statement (closes 20 August, paid 5 September).
    expect(amountDue(CARD, movements, utc("2026-08-25"))).toBe(200_000);
    // Third.
    expect(amountDue(CARD, movements, utc("2026-09-25"))).toBe(200_000);
  });

  it("stops charging once the instalments run out", () => {
    const movements = [
      { date: utc("2026-07-10"), amount: 1_200_000, installmentCount: 3 },
    ];

    expect(amountDue(CARD, movements, utc("2026-09-25"))).toBe(400_000);
    // The fourth statement owes nothing: it was only ever three instalments.
    expect(amountDue(CARD, movements, utc("2026-10-25"))).toBe(0);
  });

  it("a normal purchase is charged once, on its own statement only", () => {
    const movements = [{ date: utc("2026-07-10"), amount: 300_000 }];

    expect(amountDue(CARD, movements, utc("2026-07-25"))).toBe(300_000);
    // Next month it's already been paid — it must not be demanded twice.
    expect(amountDue(CARD, movements, utc("2026-08-25"))).toBe(0);
  });

  it("ignores purchases that haven't been billed yet", () => {
    // Bought on 25 July: after the 20 July close, so it's on the NEXT statement.
    const movements = [{ date: utc("2026-07-25"), amount: 500_000 }];

    expect(amountDue(CARD, movements, utc("2026-07-26"))).toBe(0);
  });
});
