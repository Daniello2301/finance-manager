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
import { requireSession } from "@/lib/api-auth";
import { DELETE, PATCH } from "@/app/api/categories/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/categories/x", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/categories/[id]", () => {
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

  describe("PATCH", () => {
    it("updates name/color/icon", async () => {
      const category = await Category.create({
        userId,
        name: "Viejo",
        type: "expense",
      });

      const res = await PATCH(
        makeRequest("PATCH", { name: "Nuevo", color: "#FF0000" }),
        withParams(category.id)
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category.name).toBe("Nuevo");
      expect(body.category.color).toBe("#FF0000");
    });

    it("allows editing a default (isDefault: true) category", async () => {
      const category = await Category.create({
        userId,
        name: "Salario",
        type: "income",
        isDefault: true,
      });

      const res = await PATCH(
        makeRequest("PATCH", { name: "Sueldo" }),
        withParams(category.id)
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.category.name).toBe("Sueldo");
      expect(body.category.isDefault).toBe(true);
    });

    it("rejects a type change with 422, even to the same value", async () => {
      const category = await Category.create({
        userId,
        name: "Transporte",
        type: "expense",
      });

      const res = await PATCH(
        makeRequest("PATCH", { type: "expense" }),
        withParams(category.id)
      );
      expect(res.status).toBe(422);
    });

    it("returns 404 for another user's category", async () => {
      const category = await Category.create({
        userId: otherUserId,
        name: "No tuya",
        type: "expense",
      });

      const res = await PATCH(
        makeRequest("PATCH", { name: "Hackeado" }),
        withParams(category.id)
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent id", async () => {
      const res = await PATCH(
        makeRequest("PATCH", { name: "X" }),
        withParams(new mongoose.Types.ObjectId().toString())
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("archives the category instead of deleting it", async () => {
      const category = await Category.create({
        userId,
        name: "Entretenimiento",
        type: "expense",
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(category.id));
      expect(res.status).toBe(200);

      const stillExists = await Category.findById(category.id);
      expect(stillExists).not.toBeNull();
      expect(stillExists?.isArchived).toBe(true);
    });

    it("archives a default category too", async () => {
      const category = await Category.create({
        userId,
        name: "Vivienda",
        type: "expense",
        isDefault: true,
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(category.id));
      expect(res.status).toBe(200);

      const stillExists = await Category.findById(category.id);
      expect(stillExists?.isArchived).toBe(true);
      expect(stillExists?.isDefault).toBe(true);
    });

    it("returns 404 for another user's category", async () => {
      const category = await Category.create({
        userId: otherUserId,
        name: "No tuya",
        type: "expense",
      });

      const res = await DELETE(makeRequest("DELETE"), withParams(category.id));
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
