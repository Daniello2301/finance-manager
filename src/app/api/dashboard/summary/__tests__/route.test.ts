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
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Budget from "@/lib/models/Budget";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { periodRange } from "@/lib/services/budgets";
import { requireSession } from "@/lib/api-auth";
import { GET } from "@/app/api/dashboard/summary/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

describe("GET /api/dashboard/summary", () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestDb();
    await connectDB();
  }, 30000);

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
    await stopTestDb();
  });

  it("returns the balance summary and top budgets", async () => {
    await Account.create({
      userId,
      name: "Ahorros",
      type: "bank",
      currency: "COP",
      initialBalance: 500000,
      currentBalance: 500000,
    });

    const category = await Category.create({
      userId,
      name: "Mercado",
      type: "expense",
    });
    const period = currentPeriodKey();
    await Budget.create({
      userId,
      categoryId: category.id,
      periodKey: period,
      periodStart: periodRange(period).periodStart,
      limitAmount: 100000,
      currency: "COP",
    });
    await Transaction.create({
      userId,
      accountId: new mongoose.Types.ObjectId(),
      categoryId: category.id,
      type: "expense",
      amount: 50000,
      currency: "COP",
      date: periodRange(period).periodStart,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balances).toEqual([{ currency: "COP", total: 500000 }]);
    expect(body.topBudgets).toHaveLength(1);
    expect(body.topBudgets[0].percentUsed).toBe(50);
  });

  it("returns empty structures for a user with no data", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balances).toEqual([]);
    expect(body.topBudgets).toEqual([]);
  });
});
