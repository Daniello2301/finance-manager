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
import { UnauthorizedError } from "@/lib/errors";
import { GET, POST } from "@/app/api/categories/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/api/categories${query}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/categories", () => {
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
    it("creates a custom category with isDefault: false", async () => {
      const res = await POST(
        makePostRequest({ name: "Mascotas Extra", type: "expense" })
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.category.name).toBe("Mascotas Extra");
      expect(body.category.isDefault).toBe(false);
      expect(body.category.userId).toBe(userId);
    });

    it("returns 422 for a missing name", async () => {
      const res = await POST(makePostRequest({ type: "expense" }));
      expect(res.status).toBe(422);
    });

    it("returns 422 for an invalid type", async () => {
      const res = await POST(
        makePostRequest({ name: "X", type: "invalid" })
      );
      expect(res.status).toBe(422);
    });

    it("returns 409 for a duplicate name+type for the same user", async () => {
      await POST(makePostRequest({ name: "Transporte", type: "expense" }));
      const res = await POST(
        makePostRequest({ name: "Transporte", type: "expense" })
      );
      expect(res.status).toBe(409);

      const count = await Category.countDocuments({
        userId,
        name: "Transporte",
        type: "expense",
      });
      expect(count).toBe(1);
    });

    it("allows the same name across different types", async () => {
      await POST(makePostRequest({ name: "Ahorro", type: "income" }));
      const res = await POST(
        makePostRequest({ name: "Ahorro", type: "expense" })
      );
      expect(res.status).toBe(201);
    });

    it("returns 401 when there is no session", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        new UnauthorizedError()
      );
      const res = await POST(makePostRequest({ name: "X", type: "expense" }));
      expect(res.status).toBe(401);
    });
  });

  describe("GET", () => {
    it("lists only the caller's active categories by default", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      await Category.create({ userId, name: "Mine", type: "expense" });
      await Category.create({
        userId,
        name: "Archived",
        type: "expense",
        isArchived: true,
      });
      await Category.create({
        userId: otherUserId,
        name: "Theirs",
        type: "expense",
      });

      const res = await GET(makeGetRequest());
      const body = await res.json();
      expect(body.categories).toHaveLength(1);
      expect(body.categories[0].name).toBe("Mine");
    });

    it("filters by type", async () => {
      await Category.create({ userId, name: "Salario", type: "income" });
      await Category.create({ userId, name: "Transporte", type: "expense" });

      const res = await GET(makeGetRequest("?type=income"));
      const body = await res.json();
      expect(body.categories).toHaveLength(1);
      expect(body.categories[0].name).toBe("Salario");
    });

    it("includes archived categories when includeArchived=true", async () => {
      await Category.create({ userId, name: "Active", type: "expense" });
      await Category.create({
        userId,
        name: "Archived",
        type: "expense",
        isArchived: true,
      });

      const res = await GET(makeGetRequest("?includeArchived=true"));
      const body = await res.json();
      expect(body.categories).toHaveLength(2);
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
