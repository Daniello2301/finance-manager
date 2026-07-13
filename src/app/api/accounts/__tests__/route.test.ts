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
import { requireSession } from "@/lib/api-auth";
import { UnauthorizedError } from "@/lib/errors";
import { GET, POST } from "@/app/api/accounts/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/api/accounts${query}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/accounts", () => {
  const userId = new mongoose.Types.ObjectId().toString();

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

  describe("POST", () => {
    it("creates an account with currentBalance = initialBalance", async () => {
      const res = await POST(
        makePostRequest({
          name: "Bancolombia Ahorros",
          type: "bank",
          initialBalance: 500000,
        })
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.account.currentBalance).toBe(500000);
      expect(body.account.currency).toBe("COP");
      expect(body.account.userId).toBe(userId);
    });

    it("returns 422 for creditLimit on a non-credit_card account", async () => {
      const res = await POST(
        makePostRequest({
          name: "X",
          type: "bank",
          initialBalance: 0,
          creditLimit: 100,
        })
      );
      expect(res.status).toBe(422);
    });

    it("returns 401 when there is no session", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        new UnauthorizedError()
      );
      const res = await POST(
        makePostRequest({ name: "X", type: "cash", initialBalance: 0 })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("GET", () => {
    it("lists only the caller's active accounts by default", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      await Account.create({
        userId,
        name: "Mine",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
      });
      await Account.create({
        userId,
        name: "Archived",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
        isArchived: true,
      });
      await Account.create({
        userId: otherUserId,
        name: "Theirs",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await GET(makeGetRequest());
      const body = await res.json();
      expect(body.accounts).toHaveLength(1);
      expect(body.accounts[0].name).toBe("Mine");
    });

    it("includes archived accounts when includeArchived=true", async () => {
      await Account.create({
        userId,
        name: "Active",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
      });
      await Account.create({
        userId,
        name: "Archived",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
        isArchived: true,
      });

      const res = await GET(makeGetRequest("?includeArchived=true"));
      const body = await res.json();
      expect(body.accounts).toHaveLength(2);
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
