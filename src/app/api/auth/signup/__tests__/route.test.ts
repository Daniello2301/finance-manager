import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Category from "@/lib/models/Category";
import { POST } from "@/app/api/auth/signup/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  email: "new@example.com",
  name: "Nueva Persona",
  password: "SecurePass123!",
  confirmPassword: "SecurePass123!",
};

describe("POST /api/auth/signup", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it("creates a user and returns 201 without leaking passwordHash", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe("new@example.com");
    expect(body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    const stored = await User.findOne({ email: "new@example.com" }).select(
      "+passwordHash"
    );
    expect(stored?.passwordHash).not.toBe(validPayload.password);
  });

  it("seeds the 21 default categories for the new user", async () => {
    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    const categories = await Category.find({ userId: body.user.id });
    expect(categories).toHaveLength(21);
    expect(categories.every((c) => c.isDefault)).toBe(true);
    expect(
      categories.filter((c) => c.type === "income")
    ).toHaveLength(4);
    expect(
      categories.filter((c) => c.type === "expense")
    ).toHaveLength(17);
  });

  it("rolls back the user if seeding default categories fails", async () => {
    const insertManySpy = vi
      .spyOn(Category, "insertMany")
      .mockRejectedValueOnce(new Error("seed boom"));

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(500);

    const user = await User.findOne({ email: validPayload.email });
    expect(user).toBeNull();

    insertManySpy.mockRestore();
  });

  it("returns 422 for a malformed email", async () => {
    const res = await POST(
      makeRequest({ ...validPayload, email: "not-an-email" })
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for a weak password", async () => {
    const res = await POST(
      makeRequest({
        ...validPayload,
        password: "weak",
        confirmPassword: "weak",
      })
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for a mismatched confirmPassword", async () => {
    const res = await POST(
      makeRequest({ ...validPayload, confirmPassword: "Different123!" })
    );
    expect(res.status).toBe(422);
  });

  it("returns 409 for a duplicate email", async () => {
    await POST(makeRequest(validPayload));
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(409);

    const count = await User.countDocuments({ email: "new@example.com" });
    expect(count).toBe(1);
  });
});
