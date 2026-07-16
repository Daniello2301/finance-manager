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
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import RecurringTransaction from "@/lib/models/RecurringTransaction";
import { requireSession } from "@/lib/api-auth";
import { UnauthorizedError } from "@/lib/errors";
import { GET, POST } from "@/app/api/recurring/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeGet() {
  return new NextRequest("http://localhost/api/recurring");
}
function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/recurring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/recurring", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestDb();
    await connectDB();
  });

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

  async function seedAccount(owner = userId) {
    return Account.create({
      userId: owner,
      name: "Nu",
      type: "bank",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });
  }
  async function seedCategory(owner = userId, type: "income" | "expense" = "expense") {
    return Category.create({ userId: owner, name: "Suscripciones", type });
  }

  describe("POST", () => {
    it("creates a template, deriving anchorDay and the first future due date", async () => {
      const account = await seedAccount();
      const category = await seedCategory();

      const res = await POST(
        makePost({
          name: "Netflix",
          type: "expense",
          amount: 44900,
          accountId: account.id,
          categoryId: category.id,
          frequency: "monthly",
          startDate: "2026-07-20",
          autoGenerate: true,
        })
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.recurring.anchorDay).toBe(20);
      // First due is on/after today, never backfilled.
      expect(new Date(body.recurring.nextDueDate).getUTCDate()).toBe(20);
      expect(new Date(body.recurring.nextDueDate).getTime()).toBeGreaterThanOrEqual(
        Date.now() - 24 * 60 * 60 * 1000
      );
    });

    it("returns 422 for an invalid payload", async () => {
      const res = await POST(makePost({ name: "Sin nada" }));
      expect(res.status).toBe(422);
    });

    it("returns 404 when the account belongs to another user", async () => {
      const account = await seedAccount(otherUserId);
      const category = await seedCategory();

      const res = await POST(
        makePost({
          name: "Netflix",
          type: "expense",
          amount: 44900,
          accountId: account.id,
          categoryId: category.id,
          frequency: "monthly",
          startDate: "2026-07-20",
          autoGenerate: true,
        })
      );
      expect(res.status).toBe(404);
    });

    it("returns 422 when the category type doesn't match the template type", async () => {
      const account = await seedAccount();
      const incomeCategory = await seedCategory(userId, "income");

      const res = await POST(
        makePost({
          name: "Netflix",
          type: "expense",
          amount: 44900,
          accountId: account.id,
          categoryId: incomeCategory.id,
          frequency: "monthly",
          startDate: "2026-07-20",
          autoGenerate: true,
        })
      );
      expect(res.status).toBe(422);
    });

    it("returns 401 without a session", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(new UnauthorizedError());
      const res = await POST(makePost({}));
      expect(res.status).toBe(401);
    });
  });

  describe("GET", () => {
    it("lists only the caller's active templates by default", async () => {
      const account = await seedAccount();
      const category = await seedCategory();
      const base = {
        userId,
        amount: 1000,
        accountId: account.id,
        categoryId: category.id,
        frequency: "monthly" as const,
        anchorDay: 5,
        startDate: new Date("2026-07-05"),
        nextDueDate: new Date("2026-08-05"),
        autoGenerate: true,
        type: "expense" as const,
      };
      await RecurringTransaction.create([
        { ...base, name: "Activo" },
        { ...base, name: "Archivado", isArchived: true },
        { ...base, name: "De otro", userId: otherUserId },
      ]);

      const res = await GET(makeGet());
      const body = await res.json();
      expect(body.recurring).toHaveLength(1);
      expect(body.recurring[0].name).toBe("Activo");
    });
  });
});
