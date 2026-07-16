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
import Transaction from "@/lib/models/Transaction";
import { requireSession } from "@/lib/api-auth";
import { UnauthorizedError } from "@/lib/errors";
import { POST } from "@/app/api/transfers/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/transfers", () => {
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

  async function seedAccount(
    userIdForAccount = userId,
    currentBalance = 1_000_000,
    overrides: Record<string, unknown> = {}
  ) {
    return Account.create({
      userId: userIdForAccount,
      name: "Cuenta",
      type: "bank",
      currency: "COP",
      initialBalance: currentBalance,
      currentBalance,
      ...overrides,
    });
  }

  it("moves money between two of the caller's accounts and 201s", async () => {
    const from = await seedAccount(userId, 2_000_000);
    const to = await seedAccount(userId, -800_000, { type: "credit_card" });

    const res = await POST(
      makePostRequest({
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 800_000,
      })
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.transfer.out.origin).toBe("transfer");
    expect(body.transfer.in.origin).toBe("transfer");
    // Both legs share the same transferId.
    expect(body.transfer.out.transferId).toBe(body.transfer.in.transferId);

    const updatedFrom = await Account.findById(from.id);
    const updatedTo = await Account.findById(to.id);
    expect(updatedFrom?.currentBalance).toBe(1_200_000);
    expect(updatedTo?.currentBalance).toBe(0);

    // Two linked transactions exist.
    const legs = await Transaction.find({ userId });
    expect(legs).toHaveLength(2);
  });

  it("returns 422 for the same source and destination account", async () => {
    const account = await seedAccount();

    const res = await POST(
      makePostRequest({
        fromAccountId: account.id,
        toAccountId: account.id,
        amount: 1000,
      })
    );
    expect(res.status).toBe(422);

    // Nothing moved.
    const unchanged = await Account.findById(account.id);
    expect(unchanged?.currentBalance).toBe(1_000_000);
  });

  it("returns 422 for a non-positive amount", async () => {
    const from = await seedAccount();
    const to = await seedAccount();

    const res = await POST(
      makePostRequest({
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 0,
      })
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when either account belongs to another user, without moving anything", async () => {
    const from = await seedAccount(userId, 500_000);
    const foreign = await seedAccount(otherUserId, 0);

    const res = await POST(
      makePostRequest({
        fromAccountId: from.id,
        toAccountId: foreign.id,
        amount: 100_000,
      })
    );
    expect(res.status).toBe(404);

    const unchanged = await Account.findById(from.id);
    expect(unchanged?.currentBalance).toBe(500_000);
  });

  it("returns 422 with the shortfall body when the source can't cover it", async () => {
    const from = await seedAccount(userId, 100_000);
    const to = await seedAccount(userId, 0);

    const res = await POST(
      makePostRequest({
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: 250_000,
      })
    );
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.code).toBe("INSUFFICIENT_FUNDS");
    expect(body.available).toBe(100_000);
    expect(body.currency).toBe("COP");

    // The blocked transfer left no half behind.
    const unchangedFrom = await Account.findById(from.id);
    const unchangedTo = await Account.findById(to.id);
    expect(unchangedFrom?.currentBalance).toBe(100_000);
    expect(unchangedTo?.currentBalance).toBe(0);
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new UnauthorizedError());

    const res = await POST(
      makePostRequest({
        fromAccountId: "x",
        toAccountId: "y",
        amount: 1000,
      })
    );
    expect(res.status).toBe(401);
  });
});
