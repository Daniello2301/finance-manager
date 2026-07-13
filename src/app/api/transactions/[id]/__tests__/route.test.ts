import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
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
import { requireSession } from "@/lib/api-auth";
import { createTransaction } from "@/lib/services/transactions";
import { DELETE, GET, PATCH } from "@/app/api/transactions/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/transactions/x", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/transactions/[id]", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestReplSet();
    await connectDB();
  }, 60000);

  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: userId, name: "Ana", email: "ana@example.com" },
      expires: "2026-08-01T00:00:00.000Z",
    } as never);
  });

  afterEach(async () => {
    await clearTestDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await stopTestReplSet();
  }, 30000);

  async function seedAccount(userIdForAccount = userId, currentBalance = 0) {
    return Account.create({
      userId: userIdForAccount,
      name: "Cuenta",
      type: "bank",
      currency: "COP",
      initialBalance: currentBalance,
      currentBalance,
    });
  }

  async function seedCategory(
    userIdForCategory = userId,
    type: "income" | "expense" = "expense"
  ) {
    return Category.create({
      userId: userIdForCategory,
      name: "Categoria",
      type,
    });
  }

  describe("GET", () => {
    it("returns the caller's own transaction", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      const res = await GET(makeRequest("GET"), withParams(tx.id));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.transaction.amount).toBe(100);
    });

    it("returns 404 for another user's transaction", async () => {
      const account = await seedAccount(otherUserId);
      const category = await seedCategory(otherUserId);
      const tx = await createTransaction(otherUserId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      const res = await GET(makeRequest("GET"), withParams(tx.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent id", async () => {
      const res = await GET(
        makeRequest("GET"),
        withParams(new mongoose.Types.ObjectId().toString())
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH", () => {
    it("updates the description without touching the balance", async () => {
      const account = await seedAccount(userId, 100000);
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 10000,
        date: new Date(),
      });

      const res = await PATCH(
        makeRequest("PATCH", { description: "Nota" }),
        withParams(tx.id)
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.transaction.description).toBe("Nota");

      const reloadedAccount = await Account.findById(account.id);
      expect(reloadedAccount?.currentBalance).toBe(90000);
    });

    it("recalculates the balance when the amount changes", async () => {
      const account = await seedAccount(userId, 100000);
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 25000,
        date: new Date(),
      });

      await PATCH(makeRequest("PATCH", { amount: 40000 }), withParams(tx.id));

      const reloadedAccount = await Account.findById(account.id);
      expect(reloadedAccount?.currentBalance).toBe(60000);
    });

    it("moves the delta and re-validates ownership when accountId changes", async () => {
      const accountA = await seedAccount(userId, 100000);
      const accountB = await seedAccount(userId, 50000);
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: accountA.id,
        categoryId: category.id,
        type: "expense",
        amount: 20000,
        date: new Date(),
      });

      const res = await PATCH(
        makeRequest("PATCH", { accountId: accountB.id }),
        withParams(tx.id)
      );
      expect(res.status).toBe(200);

      const reloadedA = await Account.findById(accountA.id);
      const reloadedB = await Account.findById(accountB.id);
      expect(reloadedA?.currentBalance).toBe(100000);
      expect(reloadedB?.currentBalance).toBe(30000);
    });

    it("returns 404 when the new accountId belongs to another user", async () => {
      const account = await seedAccount(userId, 100000);
      const category = await seedCategory();
      const foreignAccount = await seedAccount(otherUserId);
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 10000,
        date: new Date(),
      });

      const res = await PATCH(
        makeRequest("PATCH", { accountId: foreignAccount.id }),
        withParams(tx.id)
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when the new categoryId belongs to another user", async () => {
      const account = await seedAccount(userId, 100000);
      const category = await seedCategory();
      const foreignCategory = await seedCategory(otherUserId);
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 10000,
        date: new Date(),
      });

      const res = await PATCH(
        makeRequest("PATCH", { categoryId: foreignCategory.id }),
        withParams(tx.id)
      );
      expect(res.status).toBe(404);
    });

    it("returns 422 for an invalid payload", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 10000,
        date: new Date(),
      });

      const res = await PATCH(
        makeRequest("PATCH", { amount: -5 }),
        withParams(tx.id)
      );
      expect(res.status).toBe(422);
    });

    it("returns 404 for another user's transaction", async () => {
      const account = await seedAccount(otherUserId);
      const category = await seedCategory(otherUserId);
      const tx = await createTransaction(otherUserId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      const res = await PATCH(
        makeRequest("PATCH", { description: "Hackeado" }),
        withParams(tx.id)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("reverts the balance and removes the transaction", async () => {
      const account = await seedAccount(userId, 550000);
      const category = await seedCategory(userId, "income");
      const tx = await createTransaction(userId, {
        accountId: account.id,
        categoryId: category.id,
        type: "income",
        amount: 50000,
        date: new Date(),
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(tx.id));
      expect(res.status).toBe(200);

      const reloadedAccount = await Account.findById(account.id);
      expect(reloadedAccount?.currentBalance).toBe(550000);
      expect(await Transaction.findById(tx.id)).toBeNull();
    });

    it("returns 404 for another user's transaction", async () => {
      const account = await seedAccount(otherUserId);
      const category = await seedCategory(otherUserId);
      const tx = await createTransaction(otherUserId, {
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 100,
        date: new Date(),
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(tx.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent id", async () => {
      const res = await DELETE(
        makeRequest("DELETE"),
        withParams(new mongoose.Types.ObjectId().toString())
      );
      expect(res.status).toBe(404);
    });
  });
});
