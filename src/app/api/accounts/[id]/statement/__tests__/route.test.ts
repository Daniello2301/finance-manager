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
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { requireSession } from "@/lib/api-auth";
import { UnauthorizedError } from "@/lib/errors";
import { GET } from "@/app/api/accounts/[id]/statement/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/accounts/[id]/statement", () => {
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

  async function seedCard(
    overrides: Record<string, unknown> = {},
    userIdForCard = userId
  ) {
    return Account.create({
      userId: userIdForCard,
      name: "Visa",
      type: "credit_card",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
      statementDay: 20,
      paymentDay: 5,
      ...overrides,
    });
  }

  it("returns the statement's two numbers, balance and amount due", async () => {
    const card = await seedCard({ currentBalance: -300_000 });
    const category = await Category.create({
      userId,
      name: "Compras",
      type: "expense",
    });
    // A normal purchase inside the closed cycle, billed in full.
    await Transaction.create({
      userId,
      accountId: card.id,
      categoryId: category.id,
      type: "expense",
      amount: 300_000,
      currency: "COP",
      date: new Date("2026-07-10T00:00:00.000Z"),
    });

    const res = await GET(new Request("http://localhost"), withParams(card.id));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.statement.currentBalance).toBe(-300_000);
    expect(typeof body.statement.amountDue).toBe("number");
    expect(body.statement.currency).toBe("COP");
    expect(body.statement.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.statement.nextDue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns 422 when the account isn't a credit card", async () => {
    const account = await Account.create({
      userId,
      name: "Ahorros",
      type: "bank",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });

    const res = await GET(
      new Request("http://localhost"),
      withParams(account.id)
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when the card has no billing cycle configured", async () => {
    const card = await seedCard({ statementDay: undefined, paymentDay: undefined });

    const res = await GET(new Request("http://localhost"), withParams(card.id));
    expect(res.status).toBe(422);
  });

  it("returns 404 for another user's card, never 403", async () => {
    const card = await seedCard({}, otherUserId);

    const res = await GET(new Request("http://localhost"), withParams(card.id));
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent id", async () => {
    const res = await GET(
      new Request("http://localhost"),
      withParams(new mongoose.Types.ObjectId().toString())
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new UnauthorizedError());

    const res = await GET(
      new Request("http://localhost"),
      withParams(new mongoose.Types.ObjectId().toString())
    );
    expect(res.status).toBe(401);
  });
});
