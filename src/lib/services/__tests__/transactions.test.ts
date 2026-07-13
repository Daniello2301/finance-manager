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
import { NotFoundError } from "@/lib/errors";
import {
  createTransaction,
  deleteTransaction,
  signedDelta,
  updateTransaction,
} from "@/lib/services/transactions";

describe("signedDelta", () => {
  it("returns a positive delta for income", () => {
    expect(signedDelta("income", 500)).toBe(500);
  });

  it("returns a negative delta for expense", () => {
    expect(signedDelta("expense", 500)).toBe(-500);
  });
});

describe("transactions service", () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestReplSet();
    await connectDB();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestReplSet();
  }, 30000);

  async function seedAccount(currentBalance = 1_000_000, currency = "COP") {
    return Account.create({
      userId,
      name: "Cuenta",
      type: "bank",
      currency,
      initialBalance: currentBalance,
      currentBalance,
    });
  }

  async function seedCategory(type: "income" | "expense" = "expense") {
    return Category.create({ userId, name: "Categoria", type });
  }

  describe("createTransaction", () => {
    it("creates a transaction and applies a negative delta for an expense", async () => {
      const account = await seedAccount(100000);
      const category = await seedCategory("expense");

      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 25000,
        date: new Date("2026-02-01"),
      });

      expect(tx.amount).toBe(25000);
      expect(tx.currency).toBe("COP");

      const updatedAccount = await Account.findById(account.id);
      expect(updatedAccount?.currentBalance).toBe(75000);
    });

    it("applies a positive delta for an income", async () => {
      const account = await seedAccount(500000);
      const category = await seedCategory("income");

      await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "income",
        amount: 50000,
        date: new Date(),
      });

      const updatedAccount = await Account.findById(account.id);
      expect(updatedAccount?.currentBalance).toBe(550000);
    });

    it("inherits currency from the account, ignoring anything else", async () => {
      const account = await seedAccount(1_000_000, "COP");
      const category = await seedCategory();

      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      expect(tx.currency).toBe("COP");
    });

    it("throws NotFoundError for an account that doesn't belong to the user", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const otherUserId = new mongoose.Types.ObjectId().toString();

      await expect(
        createTransaction(otherUserId, {
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          date: new Date(),
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("rolls back both the account balance and the transaction doc on a mid-transaction failure", async () => {
      const account = await seedAccount(100000);
      const category = await seedCategory();

      const spy = vi.spyOn(Transaction, "create").mockImplementation(() => {
        throw new Error("Simulated failure");
      });

      await expect(
        createTransaction(userId, {
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 25000,
          date: new Date(),
        })
      ).rejects.toThrow();

      const reloadedAccount = await Account.findById(account.id);
      expect(reloadedAccount?.currentBalance).toBe(100000);
      expect(await Transaction.countDocuments({})).toBe(0);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateTransaction", () => {
    it("recalculates the balance when only the amount changes", async () => {
      const account = await seedAccount(100000);
      const category = await seedCategory();

      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 25000,
        date: new Date(),
      });

      await updateTransaction(userId, tx.id, { amount: 40000 });

      const updatedAccount = await Account.findById(account.id);
      expect(updatedAccount?.currentBalance).toBe(60000);
    });

    it("moves the delta between accounts when accountId changes", async () => {
      const accountA = await seedAccount(100000);
      const accountB = await seedAccount(200000);
      const category = await seedCategory();

      const tx = await createTransaction(userId, {
        accountId: accountA.id,
        categoryId: category.id,
        type: "expense",
        amount: 20000,
        date: new Date(),
      });

      await updateTransaction(userId, tx.id, { accountId: accountB.id });

      const updatedA = await Account.findById(accountA.id);
      const updatedB = await Account.findById(accountB.id);
      expect(updatedA?.currentBalance).toBe(100000);
      expect(updatedB?.currentBalance).toBe(180000);
    });

    it("recalculates when both amount and account change together", async () => {
      const accountA = await seedAccount(100000);
      const accountB = await seedAccount(50000);
      const category = await seedCategory();

      const tx = await createTransaction(userId, {
        accountId: accountA.id,
        categoryId: category.id,
        type: "expense",
        amount: 20000,
        date: new Date(),
      });

      await updateTransaction(userId, tx.id, {
        accountId: accountB.id,
        amount: 10000,
      });

      const updatedA = await Account.findById(accountA.id);
      const updatedB = await Account.findById(accountB.id);
      expect(updatedA?.currentBalance).toBe(100000);
      expect(updatedB?.currentBalance).toBe(40000);
    });

    it("recalculates when type changes (expense -> income), same account/amount", async () => {
      const account = await seedAccount(100000);
      const expenseCategory = await seedCategory("expense");
      const incomeCategory = await seedCategory("income");

      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: expenseCategory.id,
        type: "expense",
        amount: 10000,
        date: new Date(),
      });

      await updateTransaction(userId, tx.id, {
        type: "income",
        categoryId: incomeCategory.id,
      });

      const updatedAccount = await Account.findById(account.id);
      expect(updatedAccount?.currentBalance).toBe(110000);
    });

    it("recalculates when type and account change together", async () => {
      const accountA = await seedAccount(100000);
      const accountB = await seedAccount(50000);
      const expenseCategory = await seedCategory("expense");
      const incomeCategory = await seedCategory("income");

      const tx = await createTransaction(userId, {
        accountId: accountA.id,
        categoryId: expenseCategory.id,
        type: "expense",
        amount: 10000,
        date: new Date(),
      });

      await updateTransaction(userId, tx.id, {
        accountId: accountB.id,
        type: "income",
        categoryId: incomeCategory.id,
      });

      const updatedA = await Account.findById(accountA.id);
      const updatedB = await Account.findById(accountB.id);
      expect(updatedA?.currentBalance).toBe(100000);
      expect(updatedB?.currentBalance).toBe(60000);
    });

    it("leaves the balance unchanged when only description/date are edited", async () => {
      const account = await seedAccount(100000);
      const category = await seedCategory();

      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 10000,
        date: new Date("2026-01-01"),
      });

      const updated = await updateTransaction(userId, tx.id, {
        description: "Nota",
        date: new Date("2026-01-02"),
      });

      expect(updated.description).toBe("Nota");
      const reloadedAccount = await Account.findById(account.id);
      expect(reloadedAccount?.currentBalance).toBe(90000);
    });

    it("throws NotFoundError for a transaction that doesn't exist", async () => {
      await expect(
        updateTransaction(userId, new mongoose.Types.ObjectId().toString(), {
          amount: 1,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for another user's transaction", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      const otherUserId = new mongoose.Types.ObjectId().toString();
      await expect(
        updateTransaction(otherUserId, tx.id, { amount: 200 })
      ).rejects.toThrow(NotFoundError);
    });

    it("rolls back the reverted balance on the original account if applying the new delta fails", async () => {
      const accountA = await seedAccount(100000);
      const accountB = await seedAccount(50000);
      const category = await seedCategory();

      const tx = await createTransaction(userId, {
        accountId: accountA.id,
        categoryId: category.id,
        type: "expense",
        amount: 20000,
        date: new Date(),
      });

      const originalFindOneAndUpdate = Account.findOneAndUpdate.bind(Account);
      let callCount = 0;
      vi.spyOn(Account, "findOneAndUpdate").mockImplementation(
        (...args: Parameters<typeof Account.findOneAndUpdate>) => {
          callCount += 1;
          if (callCount === 2) {
            throw new Error("Simulated failure applying new delta");
          }
          return originalFindOneAndUpdate(...args);
        }
      );

      await expect(
        updateTransaction(userId, tx.id, { accountId: accountB.id })
      ).rejects.toThrow();

      const reloadedA = await Account.findById(accountA.id);
      const reloadedB = await Account.findById(accountB.id);
      const reloadedTx = await Transaction.findById(tx.id);

      expect(reloadedA?.currentBalance).toBe(80000);
      expect(reloadedB?.currentBalance).toBe(50000);
      expect(reloadedTx?.accountId.toString()).toBe(accountA.id);
    });
  });

  describe("deleteTransaction", () => {
    it("reverts the balance effect and removes the transaction", async () => {
      const account = await seedAccount(550000);
      const category = await seedCategory("income");

      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "income",
        amount: 50000,
        date: new Date(),
      });

      await deleteTransaction(userId, tx.id);

      const updatedAccount = await Account.findById(account.id);
      expect(updatedAccount?.currentBalance).toBe(550000);
      expect(await Transaction.findById(tx.id)).toBeNull();
    });

    it("throws NotFoundError for a transaction that doesn't exist", async () => {
      await expect(
        deleteTransaction(userId, new mongoose.Types.ObjectId().toString())
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for another user's transaction", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      const otherUserId = new mongoose.Types.ObjectId().toString();
      await expect(deleteTransaction(otherUserId, tx.id)).rejects.toThrow(
        NotFoundError
      );
    });

    it("rolls back if reverting the balance fails mid-transaction", async () => {
      const account = await seedAccount(100000);
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 20000,
        date: new Date(),
      });

      vi.spyOn(Account, "findOneAndUpdate").mockImplementation(() => {
        throw new Error("Simulated failure");
      });

      await expect(deleteTransaction(userId, tx.id)).rejects.toThrow();

      const reloadedAccount = await Account.findById(account.id);
      const reloadedTx = await Transaction.findById(tx.id);
      expect(reloadedAccount?.currentBalance).toBe(80000);
      expect(reloadedTx).not.toBeNull();
    });
  });
});
