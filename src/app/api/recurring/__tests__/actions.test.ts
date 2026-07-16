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
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import RecurringTransaction from "@/lib/models/RecurringTransaction";
import { requireSession } from "@/lib/api-auth";
import { POST as confirmPOST } from "@/app/api/recurring/[id]/confirm/route";
import { POST as skipPOST } from "@/app/api/recurring/[id]/skip/route";
import { POST as catchUpPOST } from "@/app/api/recurring/catch-up/route";

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn(),
}));

function makePost(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("recurring action routes", () => {
  const userId = new mongoose.Types.ObjectId().toString();

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

  async function seed(
    overrides: Record<string, unknown> = {},
    categoryName = "Servicios"
  ) {
    const account = await Account.create({
      userId,
      name: "Nu",
      type: "bank",
      currency: "COP",
      initialBalance: 1_000_000,
      currentBalance: 1_000_000,
    });
    const category = await Category.create({
      userId,
      name: categoryName,
      type: "expense",
    });
    const rec = await RecurringTransaction.create({
      userId,
      name: "Energía",
      type: "expense",
      amount: 180_000,
      accountId: account.id,
      categoryId: category.id,
      frequency: "monthly",
      anchorDay: 10,
      startDate: new Date("2026-07-10"),
      nextDueDate: new Date("2026-07-10T00:00:00.000Z"),
      autoGenerate: false,
      ...overrides,
    });
    return { account, category, rec };
  }

  it("catch-up materialises automatic overdue occurrences and returns pending manuals", async () => {
    const { rec: manual } = await seed(); // manual, overdue
    await seed({ name: "Netflix", autoGenerate: true }, "Suscripciones"); // auto, overdue

    const res = await catchUpPOST();
    expect(res.status).toBe(200);
    const body = await res.json();

    // The automatic one was created; the manual one is returned as pending.
    expect(body.created).toBe(1);
    expect(body.pending).toHaveLength(1);
    expect(body.pending[0].recurringId).toBe(manual.id);
  });

  it("confirm materialises the occurrence, correcting the amount without touching the template", async () => {
    const { account, rec } = await seed();

    const res = await confirmPOST(
      makePost(`/api/recurring/${rec.id}/confirm`, {
        occurrenceKey: "2026-07-10",
        amount: 214_300,
      }),
      withParams(rec.id)
    );
    expect(res.status).toBe(200);

    const tx = await Transaction.findOne({ recurringTransactionId: rec.id });
    expect(tx?.amount).toBe(214_300);

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount?.currentBalance).toBe(785_700);

    const updatedRec = await RecurringTransaction.findById(rec.id);
    expect(updatedRec?.amount).toBe(180_000); // template untouched
  });

  it("confirm returns 422 for an occurrence that isn't the current pending one", async () => {
    const { rec } = await seed();
    const res = await confirmPOST(
      makePost(`/api/recurring/${rec.id}/confirm`, { occurrenceKey: "2026-09-10" }),
      withParams(rec.id)
    );
    expect(res.status).toBe(422);
  });

  it("skip advances without creating a transaction", async () => {
    const { account, rec } = await seed();

    const res = await skipPOST(
      makePost(`/api/recurring/${rec.id}/skip`, { occurrenceKey: "2026-07-10" }),
      withParams(rec.id)
    );
    expect(res.status).toBe(200);

    expect(
      await Transaction.countDocuments({ recurringTransactionId: rec.id })
    ).toBe(0);
    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount?.currentBalance).toBe(1_000_000);
  });
});
