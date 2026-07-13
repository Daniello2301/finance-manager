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
import { POST } from "@/app/api/accounts/[id]/recompute-balance/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest() {
  return new NextRequest("http://localhost/api/accounts/x/recompute-balance", {
    method: "POST",
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/accounts/[id]/recompute-balance", () => {
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

  async function seedAccount(
    userIdForAccount = userId,
    initialBalance = 0,
    currentBalance = initialBalance
  ) {
    return Account.create({
      userId: userIdForAccount,
      name: "Cuenta",
      type: "bank",
      currency: "COP",
      initialBalance,
      currentBalance,
    });
  }

  async function seedCategory(type: "income" | "expense" = "expense") {
    return Category.create({ userId, name: "Categoria", type });
  }

  it("overwrites a drifted currentBalance with the sum of initialBalance + all transactions", async () => {
    const account = await seedAccount(userId, 100000, 999999);
    const expenseCategory = await seedCategory("expense");
    const incomeCategory = await seedCategory("income");
    await Transaction.create([
      {
        userId,
        accountId: account.id,
        categoryId: expenseCategory.id,
        type: "expense",
        amount: 30000,
        currency: "COP",
        date: new Date("2026-02-01"),
      },
      {
        userId,
        accountId: account.id,
        categoryId: incomeCategory.id,
        type: "income",
        amount: 50000,
        currency: "COP",
        date: new Date("2026-02-02"),
      },
    ]);

    const res = await POST(makeRequest(), withParams(account.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    // 100000 initial - 30000 expense + 50000 income = 120000
    expect(body.account.currentBalance).toBe(120000);

    const stored = await Account.findById(account.id);
    expect(stored?.currentBalance).toBe(120000);
  });

  it("resets to initialBalance when the account has no transactions", async () => {
    const account = await seedAccount(userId, 50000, 0);

    const res = await POST(makeRequest(), withParams(account.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account.currentBalance).toBe(50000);
  });

  it("only counts transactions belonging to that account", async () => {
    const account = await seedAccount(userId, 0);
    const otherAccount = await seedAccount(userId, 0);
    const category = await seedCategory("income");
    await Transaction.create([
      {
        userId,
        accountId: account.id,
        categoryId: category.id,
        type: "income",
        amount: 10000,
        currency: "COP",
        date: new Date("2026-02-01"),
      },
      {
        userId,
        accountId: otherAccount.id,
        categoryId: category.id,
        type: "income",
        amount: 999999,
        currency: "COP",
        date: new Date("2026-02-01"),
      },
    ]);

    const res = await POST(makeRequest(), withParams(account.id));
    const body = await res.json();
    expect(body.account.currentBalance).toBe(10000);
  });

  it("returns 404 for another user's account (never 403)", async () => {
    const account = await seedAccount(otherUserId);

    const res = await POST(makeRequest(), withParams(account.id));
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent id", async () => {
    const res = await POST(
      makeRequest(),
      withParams(new mongoose.Types.ObjectId().toString())
    );
    expect(res.status).toBe(404);
  });
});
