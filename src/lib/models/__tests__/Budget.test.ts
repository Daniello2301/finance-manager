import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Budget from "@/lib/models/Budget";

describe("Budget model", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
    await Budget.init();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  const userId = new mongoose.Types.ObjectId();
  const categoryId = new mongoose.Types.ObjectId();

  it("creates a budget with valid data", async () => {
    const budget = await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 600000,
      currency: "COP",
    });

    expect(budget.periodKey).toBe("2026-07");
    expect(budget.limitAmount).toBe(600000);
    expect(budget.currency).toBe("COP");
    expect(budget.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a budget missing required fields", async () => {
    await expect(
      Budget.create({ userId, categoryId } as never)
    ).rejects.toThrow();
  });

  it("rejects a periodKey not shaped like YYYY-MM", async () => {
    await expect(
      Budget.create({
        userId,
        categoryId,
        periodKey: "2026-7",
        periodStart: new Date(2026, 6, 1),
        limitAmount: 600000,
        currency: "COP",
      })
    ).rejects.toThrow();
  });

  it("rejects a non-positive limitAmount", async () => {
    await expect(
      Budget.create({
        userId,
        categoryId,
        periodKey: "2026-07",
        periodStart: new Date(2026, 6, 1),
        limitAmount: 0,
        currency: "COP",
      })
    ).rejects.toThrow();
  });

  it("enforces a unique categoryId per userId+periodKey", async () => {
    await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 600000,
      currency: "COP",
    });

    await expect(
      Budget.create({
        userId,
        categoryId,
        periodKey: "2026-07",
        periodStart: new Date(2026, 6, 1),
        limitAmount: 100000,
        currency: "COP",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("allows the same category across different periods", async () => {
    await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 600000,
      currency: "COP",
    });

    await expect(
      Budget.create({
        userId,
        categoryId,
        periodKey: "2026-08",
        periodStart: new Date(2026, 7, 1),
        limitAmount: 600000,
        currency: "COP",
      })
    ).resolves.toBeTruthy();
  });

  it("allows different categories in the same period for the same user", async () => {
    const otherCategoryId = new mongoose.Types.ObjectId();
    await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 600000,
      currency: "COP",
    });

    await expect(
      Budget.create({
        userId,
        categoryId: otherCategoryId,
        periodKey: "2026-07",
        periodStart: new Date(2026, 6, 1),
        limitAmount: 200000,
        currency: "COP",
      })
    ).resolves.toBeTruthy();
  });

  it("findForUser returns only that user's budgets", async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 600000,
      currency: "COP",
    });
    await Budget.create({
      userId: otherUserId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 100000,
      currency: "COP",
    });

    const results = await Budget.findForUser(userId);
    expect(results).toHaveLength(1);
    expect(results[0].limitAmount).toBe(600000);
  });

  it("findForUser applies an additional filter", async () => {
    await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-07",
      periodStart: new Date(2026, 6, 1),
      limitAmount: 600000,
      currency: "COP",
    });
    await Budget.create({
      userId,
      categoryId,
      periodKey: "2026-08",
      periodStart: new Date(2026, 7, 1),
      limitAmount: 700000,
      currency: "COP",
    });

    const results = await Budget.findForUser(userId, { periodKey: "2026-08" });
    expect(results).toHaveLength(1);
    expect(results[0].limitAmount).toBe(700000);
  });
});
