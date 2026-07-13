import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Category from "@/lib/models/Category";

describe("Category model", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
    await Category.init();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  const userId = new mongoose.Types.ObjectId();

  it("creates a category with valid data", async () => {
    const category = await Category.create({
      userId,
      name: "Salario",
      type: "income",
    });

    expect(category.name).toBe("Salario");
    expect(category.type).toBe("income");
    expect(category.isDefault).toBe(false);
    expect(category.isArchived).toBe(false);
    expect(category.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a category missing required fields", async () => {
    await expect(
      Category.create({ userId, name: "X" } as never)
    ).rejects.toThrow();
  });

  it("rejects an invalid type", async () => {
    await expect(
      Category.create({ userId, name: "X", type: "invalid" } as never)
    ).rejects.toThrow();
  });

  it("enforces a unique name per userId+type", async () => {
    await Category.create({ userId, name: "Transporte", type: "expense" });

    await expect(
      Category.create({ userId, name: "Transporte", type: "expense" })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("allows the same name across different types for the same user", async () => {
    await Category.create({ userId, name: "Ahorro", type: "income" });
    await expect(
      Category.create({ userId, name: "Ahorro", type: "expense" })
    ).resolves.toBeTruthy();
  });

  it("does not change type on a later save (schema-level immutability)", async () => {
    const category = await Category.create({
      userId,
      name: "Salud",
      type: "expense",
    });

    category.type = "income";
    await category.save();

    const reloaded = await Category.findById(category._id);
    expect(reloaded?.type).toBe("expense");
  });

  it("findForUser returns only that user's categories", async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await Category.create({ userId, name: "Mine", type: "expense" });
    await Category.create({
      userId: otherUserId,
      name: "Theirs",
      type: "expense",
    });

    const results = await Category.findForUser(userId);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Mine");
  });

  it("findForUser applies an additional filter", async () => {
    await Category.create({ userId, name: "Salario", type: "income" });
    await Category.create({ userId, name: "Transporte", type: "expense" });

    const results = await Category.findForUser(userId, { type: "income" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Salario");
  });
});
