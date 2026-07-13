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
import { GET, POST } from "@/app/api/budgets/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/api/budgets${query}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/budgets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/budgets", () => {
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

  async function seedCategory(
    userIdForCategory = userId,
    type: "income" | "expense" = "expense"
  ) {
    return Category.create({ userId: userIdForCategory, name: "Mercado", type });
  }

  describe("GET", () => {
    it("returns budgets with real spend for the given period", async () => {
      const category = await seedCategory();
      await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 600000,
        })
      );
      await Transaction.create({
        userId,
        accountId: new mongoose.Types.ObjectId(),
        categoryId: category.id,
        type: "expense",
        amount: 250000,
        currency: "COP",
        date: new Date(2026, 6, 10),
      });

      const res = await GET(makeGetRequest("?period=2026-07"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.budgets).toHaveLength(1);
      expect(body.budgets[0].spentAmount).toBe(250000);
      expect(body.budgets[0].percentUsed).toBe(42);
    });

    it("returns 422 for a missing period", async () => {
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(422);
    });

    it("does not return another user's budgets", async () => {
      const category = await seedCategory(otherUserId);
      vi.mocked(requireSession).mockResolvedValueOnce({
        user: { id: otherUserId, name: "Beto", email: "beto@example.com" },
        expires: "2026-08-01T00:00:00.000Z",
      } as never);
      await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 600000,
        })
      );

      const res = await GET(makeGetRequest("?period=2026-07"));
      const body = await res.json();
      expect(body.budgets).toHaveLength(0);
    });
  });

  describe("POST", () => {
    it("creates a budget for an expense category", async () => {
      const category = await seedCategory();

      const res = await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 600000,
        })
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.budget.limitAmount).toBe(600000);
      expect(body.budget.currency).toBe("COP");
    });

    it("returns 422 for an invalid payload", async () => {
      const res = await POST(makePostRequest({ limitAmount: 1000 }));
      expect(res.status).toBe(422);
    });

    it("returns 404 when categoryId belongs to another user", async () => {
      const category = await seedCategory(otherUserId);

      const res = await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 600000,
        })
      );
      expect(res.status).toBe(404);
    });

    it("rejects a budget for an income category", async () => {
      const category = await seedCategory(userId, "income");

      const res = await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 600000,
        })
      );
      expect(res.status).toBe(422);
    });

    it("returns 409 for a duplicate categoryId+periodKey", async () => {
      const category = await seedCategory();
      await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 600000,
        })
      );

      const res = await POST(
        makePostRequest({
          categoryId: category.id,
          periodKey: "2026-07",
          limitAmount: 100000,
        })
      );
      expect(res.status).toBe(409);
    });
  });
});
