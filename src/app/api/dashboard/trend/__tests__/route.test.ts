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
import { GET } from "@/app/api/dashboard/trend/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/dashboard/trend${query}`);
}

describe("GET /api/dashboard/trend", () => {
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

  it("returns the trend defaulting to 6 months", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trend).toHaveLength(6);
  });

  it("respects a custom months window and reflects real transactions", async () => {
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
      amount: 75000,
      currency: "COP",
      date: new Date(),
    });

    const res = await GET(makeRequest("?months=3"));
    const body = await res.json();
    expect(body.trend).toHaveLength(3);
    expect(body.trend[2].expense).toBe(75000);
  });

  it("returns 422 for an out-of-range months value", async () => {
    const res = await GET(makeRequest("?months=100"));
    expect(res.status).toBe(422);
  });
});
