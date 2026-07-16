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
import { DELETE, GET, PATCH } from "@/app/api/recurring/[id]/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/recurring/x", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}
function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/recurring/[id]", () => {
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

  async function seedTemplate(owner = userId, overrides: Record<string, unknown> = {}) {
    const account = await Account.create({
      userId: owner,
      name: "Nu",
      type: "bank",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });
    const category = await Category.create({
      userId: owner,
      name: "Suscripciones",
      type: "expense",
    });
    return RecurringTransaction.create({
      userId: owner,
      name: "Netflix",
      type: "expense",
      amount: 44900,
      accountId: account.id,
      categoryId: category.id,
      frequency: "monthly",
      anchorDay: 5,
      startDate: new Date("2026-01-05"),
      nextDueDate: new Date("2026-08-05"),
      autoGenerate: true,
      ...overrides,
    });
  }

  it("returns the caller's own template", async () => {
    const rec = await seedTemplate();
    const res = await GET(makeReq("GET"), withParams(rec.id));
    expect(res.status).toBe(200);
    expect((await res.json()).recurring.name).toBe("Netflix");
  });

  it("returns 404 for another user's template, never 403", async () => {
    const rec = await seedTemplate(otherUserId);
    const res = await GET(makeReq("GET"), withParams(rec.id));
    expect(res.status).toBe(404);
  });

  it("updates simple fields like the amount", async () => {
    const rec = await seedTemplate();
    const res = await PATCH(makeReq("PATCH", { amount: 49900 }), withParams(rec.id));
    expect(res.status).toBe(200);
    expect((await res.json()).recurring.amount).toBe(49900);
  });

  // FR-008: resuming recomputes the next due forward — the paused span is not filled in.
  it("recomputes nextDueDate forward when resuming from a pause", async () => {
    const rec = await seedTemplate(userId, {
      isPaused: true,
      nextDueDate: new Date("2026-02-05"), // long overdue while paused
    });

    const res = await PATCH(makeReq("PATCH", { isPaused: false }), withParams(rec.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recurring.isPaused).toBe(false);
    // The next due is now in the future, anchored to the 5th — not the stale Feb date.
    const next = new Date(body.recurring.nextDueDate);
    expect(next.getUTCDate()).toBe(5);
    expect(next.getTime()).toBeGreaterThan(Date.parse("2026-02-05"));
  });

  it("DELETE archives instead of deleting", async () => {
    const rec = await seedTemplate();
    const res = await DELETE(makeReq("DELETE"), withParams(rec.id));
    expect(res.status).toBe(200);

    const stillThere = await RecurringTransaction.findById(rec.id);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.isArchived).toBe(true);
  });

  it("returns 404 when archiving another user's template", async () => {
    const rec = await seedTemplate(otherUserId);
    const res = await DELETE(makeReq("DELETE"), withParams(rec.id));
    expect(res.status).toBe(404);
  });
});
