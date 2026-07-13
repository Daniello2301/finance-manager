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
import { DELETE, PATCH } from "@/app/api/budgets/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/budgets/x", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/budgets/[id]", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

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

  async function seedBudget(userIdForBudget = userId, limitAmount = 600000) {
    const category = await Category.create({
      userId: userIdForBudget,
      name: "Mercado",
      type: "expense",
    });
    return Budget.create({
      userId: userIdForBudget,
      categoryId: category.id,
      periodKey: "2026-07",
      periodStart: periodRange("2026-07").periodStart,
      limitAmount,
      currency: "COP",
    });
  }

  describe("PATCH", () => {
    it("updates the limitAmount", async () => {
      const budget = await seedBudget();

      const res = await PATCH(
        makeRequest("PATCH", { limitAmount: 750000 }),
        withParams(budget.id)
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.budget.limitAmount).toBe(750000);
    });

    it("returns 422 for a non-positive limitAmount", async () => {
      const budget = await seedBudget();

      const res = await PATCH(
        makeRequest("PATCH", { limitAmount: 0 }),
        withParams(budget.id)
      );
      expect(res.status).toBe(422);
    });

    it("returns 404 for another user's budget", async () => {
      const budget = await seedBudget(otherUserId);

      const res = await PATCH(
        makeRequest("PATCH", { limitAmount: 100000 }),
        withParams(budget.id)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("permanently deletes the budget", async () => {
      const budget = await seedBudget();

      const res = await DELETE(makeRequest("DELETE"), withParams(budget.id));
      expect(res.status).toBe(200);

      const stillExists = await Budget.findById(budget.id);
      expect(stillExists).toBeNull();
    });

    it("returns 404 for another user's budget", async () => {
      const budget = await seedBudget(otherUserId);

      const res = await DELETE(makeRequest("DELETE"), withParams(budget.id));
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
