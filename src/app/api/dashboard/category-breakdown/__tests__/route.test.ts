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
import { periodRange } from "@/lib/services/budgets";
import { requireSession } from "@/lib/api-auth";
import { GET } from "@/app/api/dashboard/category-breakdown/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(query = "") {
  return new NextRequest(
    `http://localhost/api/dashboard/category-breakdown${query}`
  );
}

describe("GET /api/dashboard/category-breakdown", () => {
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

  it("returns the category breakdown for the given period", async () => {
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
      amount: 120000,
      currency: "COP",
      date: periodRange("2026-07").periodStart,
    });

    const res = await GET(makeRequest("?period=2026-07"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.breakdown).toEqual([
      expect.objectContaining({ categoryName: "Mercado", total: 120000 }),
    ]);
  });

  it("returns 422 for a missing period", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(422);
  });

  it("returns an empty breakdown for a period with no expenses", async () => {
    const res = await GET(makeRequest("?period=2026-07"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.breakdown).toEqual([]);
  });
});
