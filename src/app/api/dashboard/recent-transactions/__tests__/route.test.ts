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
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { requireSession } from "@/lib/api-auth";
import { GET } from "@/app/api/dashboard/recent-transactions/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(query = "") {
  return new NextRequest(
    `http://localhost/api/dashboard/recent-transactions${query}`
  );
}

describe("GET /api/dashboard/recent-transactions", () => {
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

  it("returns the most recent transactions, defaulting to 10", async () => {
    const category = await Category.create({
      userId,
      name: "Mercado",
      type: "expense",
    });
    await Transaction.create({
      userId,
      accountId: new mongoose.Types.ObjectId(),
      categoryId: category.id,
      type: "expense",
      amount: 10000,
      currency: "COP",
      date: new Date(2026, 0, 1),
    });
    await Transaction.create({
      userId,
      accountId: new mongoose.Types.ObjectId(),
      categoryId: category.id,
      type: "expense",
      amount: 20000,
      currency: "COP",
      date: new Date(2026, 0, 5),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].amount).toBe(20000);
  });

  it("respects a custom limit", async () => {
    const category = await Category.create({
      userId,
      name: "Mercado",
      type: "expense",
    });
    for (let i = 0; i < 3; i += 1) {
      await Transaction.create({
        userId,
        accountId: new mongoose.Types.ObjectId(),
        categoryId: category.id,
        type: "expense",
        amount: 1000 * (i + 1),
        currency: "COP",
        date: new Date(2026, 0, i + 1),
      });
    }

    const res = await GET(makeRequest("?limit=1"));
    const body = await res.json();
    expect(body.transactions).toHaveLength(1);
  });

  it("returns 422 for a limit above 50", async () => {
    const res = await GET(makeRequest("?limit=51"));
    expect(res.status).toBe(422);
  });
});
