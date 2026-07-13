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
import Budget from "@/lib/models/Budget";
import Category from "@/lib/models/Category";
import { requireSession } from "@/lib/api-auth";
import { periodRange } from "@/lib/services/budgets";
import { POST } from "@/app/api/budgets/copy/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/budgets/copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/budgets/copy", () => {
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

  async function seedBudget(periodKey: string, limitAmount: number) {
    const category = await Category.create({
      userId,
      name: `Categoria ${limitAmount}`,
      type: "expense",
    });
    return Budget.create({
      userId,
      categoryId: category.id,
      periodKey,
      periodStart: periodRange(periodKey).periodStart,
      limitAmount,
      currency: "COP",
    });
  }

  it("copies budgets from one period into another", async () => {
    await seedBudget("2026-06", 500000);
    await seedBudget("2026-06", 200000);

    const res = await POST(
      makeRequest({ fromPeriod: "2026-06", toPeriod: "2026-07" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.budgets).toHaveLength(2);

    const julyBudgets = await Budget.findForUser(userId, {
      periodKey: "2026-07",
    });
    expect(julyBudgets).toHaveLength(2);
  });

  it("returns an empty array when there is nothing to copy", async () => {
    const res = await POST(
      makeRequest({ fromPeriod: "2026-06", toPeriod: "2026-07" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.budgets).toEqual([]);
  });

  it("returns 422 for a malformed period", async () => {
    const res = await POST(
      makeRequest({ fromPeriod: "bad", toPeriod: "2026-07" })
    );
    expect(res.status).toBe(422);
  });
});
