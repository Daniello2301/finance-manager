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
import { DELETE, GET, PATCH } from "@/app/api/accounts/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/accounts/x", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/accounts/[id]", () => {
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

  describe("GET", () => {
    it("returns the caller's own account", async () => {
      const account = await Account.create({
        userId,
        name: "Ahorros",
        type: "bank",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await GET(makeRequest("GET"), withParams(account.id));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.account.name).toBe("Ahorros");
    });

    it("returns 404 for another user's account (never 403)", async () => {
      const account = await Account.create({
        userId: otherUserId,
        name: "No tuya",
        type: "bank",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await GET(makeRequest("GET"), withParams(account.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent id", async () => {
      const res = await GET(
        makeRequest("GET"),
        withParams(new mongoose.Types.ObjectId().toString())
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH", () => {
    it("updates the name", async () => {
      const account = await Account.create({
        userId,
        name: "Viejo",
        type: "bank",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await PATCH(
        makeRequest("PATCH", { name: "Nuevo" }),
        withParams(account.id)
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.account.name).toBe("Nuevo");
    });

    it("rejects a currency change with 422, even to the same value", async () => {
      const account = await Account.create({
        userId,
        name: "Ahorros",
        type: "bank",
        currency: "COP",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await PATCH(
        makeRequest("PATCH", { currency: "COP" }),
        withParams(account.id)
      );
      expect(res.status).toBe(422);
    });

    it("rejects creditLimit when the stored account isn't a credit_card", async () => {
      const account = await Account.create({
        userId,
        name: "Ahorros",
        type: "bank",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await PATCH(
        makeRequest("PATCH", { creditLimit: 1000000 }),
        withParams(account.id)
      );
      expect(res.status).toBe(422);
    });

    it("accepts creditLimit alone when the stored account is already a credit_card", async () => {
      const account = await Account.create({
        userId,
        name: "Tarjeta",
        type: "credit_card",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await PATCH(
        makeRequest("PATCH", { creditLimit: 1000000 }),
        withParams(account.id)
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.account.creditLimit).toBe(1000000);
    });

    it("returns 404 for another user's account", async () => {
      const account = await Account.create({
        userId: otherUserId,
        name: "No tuya",
        type: "bank",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await PATCH(
        makeRequest("PATCH", { name: "Hackeado" }),
        withParams(account.id)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("archives the account instead of deleting it", async () => {
      const account = await Account.create({
        userId,
        name: "Efectivo",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(account.id));
      expect(res.status).toBe(200);

      const stillExists = await Account.findById(account.id);
      expect(stillExists).not.toBeNull();
      expect(stillExists?.isArchived).toBe(true);
    });

    it("returns 404 for another user's account", async () => {
      const account = await Account.create({
        userId: otherUserId,
        name: "No tuya",
        type: "cash",
        initialBalance: 0,
        currentBalance: 0,
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(account.id));
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
