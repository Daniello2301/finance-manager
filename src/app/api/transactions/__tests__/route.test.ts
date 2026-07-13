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
import { UnauthorizedError } from "@/lib/errors";
import { GET, POST } from "@/app/api/transactions/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/api/transactions${query}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/transactions", () => {
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
    return Category.create({ userId: userIdForCategory, name: "Categoria", type });
  }

  describe("POST", () => {
    it("creates a transaction and updates the account balance", async () => {
      const account = await seedAccount(userId, 100000);
      const category = await seedCategory();

      const res = await POST(
        makePostRequest({
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 25000,
          date: "2026-02-01",
        })
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.transaction.amount).toBe(25000);
      expect(body.transaction.currency).toBe("COP");

      const updatedAccount = await Account.findById(account.id);
      expect(updatedAccount?.currentBalance).toBe(75000);
    });

    it("returns 422 for an invalid payload", async () => {
      const res = await POST(makePostRequest({ type: "expense" }));
      expect(res.status).toBe(422);
    });

    it("returns 404 when accountId belongs to another user", async () => {
      const account = await seedAccount(otherUserId);
      const category = await seedCategory();

      const res = await POST(
        makePostRequest({
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          date: "2026-01-01",
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when categoryId belongs to another user", async () => {
      const account = await seedAccount();
      const category = await seedCategory(otherUserId);

      const res = await POST(
        makePostRequest({
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          date: "2026-01-01",
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 when there is no session", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        new UnauthorizedError()
      );
      const res = await POST(
        makePostRequest({
          accountId: "x",
          categoryId: "y",
          type: "expense",
          amount: 100,
          date: "2026-01-01",
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET", () => {
    it("lists only the caller's transactions, sorted by date desc", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const otherAccount = await seedAccount(otherUserId);
      const otherCategory = await seedCategory(otherUserId);

      await Transaction.create([
        {
          userId,
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          currency: "COP",
          date: new Date("2026-01-01"),
        },
        {
          userId,
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 200,
          currency: "COP",
          date: new Date("2026-02-01"),
        },
        {
          userId: otherUserId,
          accountId: otherAccount.id,
          categoryId: otherCategory.id,
          type: "expense",
          amount: 300,
          currency: "COP",
          date: new Date("2026-01-15"),
        },
      ]);

      const res = await GET(makeGetRequest());
      const body = await res.json();

      expect(body.data).toHaveLength(2);
      expect(body.data[0].amount).toBe(200);
      expect(body.data[1].amount).toBe(100);
      expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });
    });

    it("filters by accountId, categoryId, type, and date range combined", async () => {
      const account = await seedAccount();
      const otherAccount = await seedAccount();
      const category = await seedCategory(userId, "expense");
      const incomeCategory = await seedCategory(userId, "income");

      await Transaction.create([
        {
          userId,
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          currency: "COP",
          date: new Date("2026-02-10"),
        },
        {
          userId,
          accountId: otherAccount.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          currency: "COP",
          date: new Date("2026-02-10"),
        },
        {
          userId,
          accountId: account.id,
          categoryId: incomeCategory.id,
          type: "income",
          amount: 100,
          currency: "COP",
          date: new Date("2026-02-10"),
        },
        {
          userId,
          accountId: account.id,
          categoryId: category.id,
          type: "expense",
          amount: 100,
          currency: "COP",
          date: new Date("2026-05-10"),
        },
      ]);

      const res = await GET(
        makeGetRequest(
          `?accountId=${account.id}&categoryId=${category.id}&type=expense&dateFrom=2026-01-01&dateTo=2026-03-01`
        )
      );
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });

    it("paginates with page and limit", async () => {
      const account = await seedAccount();
      const category = await seedCategory();

      await Transaction.create(
        Array.from({ length: 5 }, (_, i) => ({
          userId,
          accountId: account.id,
          categoryId: category.id,
          type: "expense" as const,
          amount: 100 + i,
          currency: "COP",
          date: new Date(2026, 0, i + 1),
        }))
      );

      const res = await GET(makeGetRequest("?page=2&limit=2"));
      const body = await res.json();

      expect(body.data).toHaveLength(2);
      expect(body.pagination).toMatchObject({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it("returns 401 when there is no session", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        new UnauthorizedError()
      );
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(401);
    });
  });
});
