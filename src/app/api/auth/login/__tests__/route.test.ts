import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import bcryptjs from "bcryptjs";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { POST } from "@/app/api/auth/login/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedUser() {
  const passwordHash = await bcryptjs.hash("CorrectPass123!", 10);
  return User.create({
    email: "existing@example.com",
    name: "Persona Existente",
    passwordHash,
  });
}

describe("POST /api/auth/login", () => {
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

  it("returns 200 and the user for valid credentials, without setting a session cookie", async () => {
    await seedUser();
    const res = await POST(
      makeRequest({
        email: "existing@example.com",
        password: "CorrectPass123!",
      })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe("existing@example.com");
    expect(body.user.passwordHash).toBeUndefined();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 401 for a wrong password", async () => {
    await seedUser();
    const res = await POST(
      makeRequest({
        email: "existing@example.com",
        password: "WrongPass123!",
      })
    );
    expect(res.status).toBe(401);
  });

  // FR-018. Without the guard in verifyCredentials, bcryptjs is handed an
  // undefined hash and THROWS — a 500 that reads as "the app is broken" instead
  // of a refused login. And the answer must be the SAME 401 as any other bad
  // credential: replying "this account uses Google" would tell an attacker the
  // address is registered, which is the leak FR-014 exists to prevent.
  it("returns an indistinguishable 401 when the account has no password (Google)", async () => {
    await User.create({
      email: "google@example.com",
      name: "Cuenta de Google",
      googleId: "google-sub-123",
    });

    const googleRes = await POST(
      makeRequest({ email: "google@example.com", password: "Whatever123!" })
    );
    const noSuchUserRes = await POST(
      makeRequest({ email: "nosuchuser@example.com", password: "Whatever123!" })
    );

    expect(googleRes.status).toBe(401);
    expect(googleRes.status).toBe(noSuchUserRes.status);
    expect(await googleRes.json()).toEqual(await noSuchUserRes.json());
  });

  it("returns the exact same 401 body for a nonexistent email as for a wrong password", async () => {
    await seedUser();
    const wrongPasswordRes = await POST(
      makeRequest({
        email: "existing@example.com",
        password: "WrongPass123!",
      })
    );
    const noSuchUserRes = await POST(
      makeRequest({
        email: "nosuchuser@example.com",
        password: "Whatever123!",
      })
    );

    expect(wrongPasswordRes.status).toBe(noSuchUserRes.status);
    const [wrongBody, noSuchBody] = await Promise.all([
      wrongPasswordRes.json(),
      noSuchUserRes.json(),
    ]);
    expect(wrongBody).toEqual(noSuchBody);
  });

  it("returns 422 for a malformed payload", async () => {
    const res = await POST(
      makeRequest({ email: "not-an-email", password: "" })
    );
    expect(res.status).toBe(422);
  });
});
