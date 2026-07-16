import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

import {
  startTestReplSet,
  stopTestReplSet,
} from "@/lib/test-utils/mongoMemoryReplSet";
import { clearTestDb } from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { InsufficientFundsError, NotFoundError, ValidationError } from "@/lib/errors";
import { transferMoney } from "@/lib/services/transfers";
import { getMonthlyTrend } from "@/lib/services/dashboard";

describe("transfers service", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestReplSet();
    await connectDB();
  }, 60000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestReplSet();
  }, 30000);

  async function seed() {
    const savings = await Account.create({
      userId,
      name: "Ahorros",
      type: "bank",
      currency: "COP",
      initialBalance: 2_000_000,
      currentBalance: 2_000_000,
    });
    // A card that has been used: this is the state the app could never get out
    // of before, because there was no way to record paying it.
    const card = await Account.create({
      userId,
      name: "Visa",
      type: "credit_card",
      currency: "COP",
      initialBalance: 0,
      currentBalance: -800_000,
      creditLimit: 2_000_000,
    });
    return { savings, card };
  }

  it("pays off a credit card: money leaves one account and lands in the other", async () => {
    const { savings, card } = await seed();

    const transfer = await transferMoney(userId, {
      fromAccountId: savings.id,
      toAccountId: card.id,
      amount: 800_000,
    });

    expect((await Account.findById(savings.id))!.currentBalance).toBe(1_200_000);
    expect((await Account.findById(card.id))!.currentBalance).toBe(0);

    // Two legs, linked, both marked as a transfer.
    expect(transfer.out.type).toBe("expense");
    expect(transfer.in.type).toBe("income");
    expect(transfer.out.origin).toBe("transfer");
    expect(transfer.in.origin).toBe("transfer");
    expect(transfer.out.transferId?.toString()).toBe(
      transfer.in.transferId?.toString()
    );
  });

  // Paying your card is not spending 800.000 and it is not earning 800.000 —
  // it's the same 800.000, somewhere else. Counting it would report a month you
  // merely moved money as a month you earned and spent a fortune.
  it("does not show up as income or as spending", async () => {
    const { savings, card } = await seed();

    await transferMoney(userId, {
      fromAccountId: savings.id,
      toAccountId: card.id,
      amount: 800_000,
      date: new Date(),
    });

    const trend = await getMonthlyTrend(userId, 1);
    expect(trend[0].income).toBe(0);
    expect(trend[0].expense).toBe(0);
  });

  // The risk the whole design exists to close. Half a transfer — money leaving
  // one account and never arriving at the other — is money destroyed.
  it("never leaves half a transfer behind when the second leg fails", async () => {
    const { savings, card } = await seed();

    // Fail the SECOND write only: the first (the money leaving) must be rolled
    // back with it. A persistent mock, not `Once` — a plain Error carries no
    // Mongo errorLabels, so withTransaction won't retry it.
    let calls = 0;
    const real = Transaction.create.bind(Transaction);
    vi.spyOn(Transaction, "create").mockImplementation(
      ((...args: unknown[]) => {
        calls += 1;
        if (calls >= 2) throw new Error("boom");
        return (real as (...a: unknown[]) => unknown)(...args);
      }) as never
    );

    await expect(
      transferMoney(userId, {
        fromAccountId: savings.id,
        toAccountId: card.id,
        amount: 800_000,
      })
    ).rejects.toThrow();

    // Nothing moved. Not the source, not the destination, no orphan leg.
    expect((await Account.findById(savings.id))!.currentBalance).toBe(2_000_000);
    expect((await Account.findById(card.id))!.currentBalance).toBe(-800_000);
    expect(await Transaction.countDocuments({ userId })).toBe(0);
  });

  // Moving money you don't have is a DECISION, so it's blocked like any expense.
  it("refuses to transfer more than the source account holds", async () => {
    const { savings, card } = await seed();
    await Account.updateOne({ _id: savings.id }, { currentBalance: 100_000 });

    await expect(
      transferMoney(userId, {
        fromAccountId: savings.id,
        toAccountId: card.id,
        amount: 250_000,
      })
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect((await Account.findById(savings.id))!.currentBalance).toBe(100_000);
    expect((await Account.findById(card.id))!.currentBalance).toBe(-800_000);
    expect(await Transaction.countDocuments({ userId })).toBe(0);
  });

  it("refuses a transfer to the same account", async () => {
    const { savings } = await seed();

    await expect(
      transferMoney(userId, {
        fromAccountId: savings.id,
        toAccountId: savings.id,
        amount: 100_000,
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("404s on an account that isn't yours, without moving anything", async () => {
    const { savings } = await seed();
    const theirs = await Account.create({
      userId: otherUserId,
      name: "Ajena",
      type: "bank",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });

    await expect(
      transferMoney(userId, {
        fromAccountId: savings.id,
        toAccountId: theirs.id,
        amount: 100_000,
      })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect((await Account.findById(savings.id))!.currentBalance).toBe(2_000_000);
    expect((await Account.findById(theirs.id))!.currentBalance).toBe(0);
  });

  it("creates the Transferencia categories on first use, once", async () => {
    const { savings, card } = await seed();

    await transferMoney(userId, {
      fromAccountId: savings.id,
      toAccountId: card.id,
      amount: 100_000,
    });
    await transferMoney(userId, {
      fromAccountId: savings.id,
      toAccountId: card.id,
      amount: 100_000,
    });

    expect(
      await Category.countDocuments({ userId, name: "Transferencia" })
    ).toBe(2); // one expense, one income — and not four.
  });
});
