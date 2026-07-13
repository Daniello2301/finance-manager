import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Category from "@/lib/models/Category";
import {
  DEFAULT_CATEGORIES,
  seedDefaultCategories,
} from "@/lib/seed/defaultCategories";

describe("DEFAULT_CATEGORIES", () => {
  it("has 4 income and 17 expense categories", () => {
    expect(DEFAULT_CATEGORIES.income).toHaveLength(4);
    expect(DEFAULT_CATEGORIES.expense).toHaveLength(17);
  });
});

describe("seedDefaultCategories", () => {
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

  it("creates all default categories for the given user, marked isDefault", async () => {
    const userId = new mongoose.Types.ObjectId();
    await seedDefaultCategories(userId);

    const categories = await Category.find({ userId });
    expect(categories).toHaveLength(21);
    expect(categories.every((c) => c.isDefault)).toBe(true);
    expect(categories.every((c) => !c.isArchived)).toBe(true);

    const income = categories.filter((c) => c.type === "income");
    const expense = categories.filter((c) => c.type === "expense");
    expect(income).toHaveLength(4);
    expect(expense).toHaveLength(17);
    expect(income.map((c) => c.name).sort()).toEqual(
      [...DEFAULT_CATEGORIES.income].sort()
    );
    expect(expense.map((c) => c.name).sort()).toEqual(
      [...DEFAULT_CATEGORIES.expense].sort()
    );
  });
});
