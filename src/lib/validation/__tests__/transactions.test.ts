import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from "@/lib/validation/transactions";

const accountId = new mongoose.Types.ObjectId().toString();
const categoryId = new mongoose.Types.ObjectId().toString();

describe("createTransactionSchema", () => {
  const valid = {
    accountId,
    categoryId,
    type: "expense" as const,
    amount: 25000,
    date: "2026-02-01",
  };

  it("accepts a valid payload and coerces the date", () => {
    const result = createTransactionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBeInstanceOf(Date);
    }
  });

  it("accepts an optional description", () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, description: "Mercado" })
        .success
    ).toBe(true);
  });

  it("rejects a malformed accountId", () => {
    const result = createTransactionSchema.safeParse({
      ...valid,
      accountId: "not-an-object-id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed categoryId", () => {
    const result = createTransactionSchema.safeParse({
      ...valid,
      categoryId: "not-an-object-id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, type: "invalid" })
        .success
    ).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, amount: 0 }).success
    ).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, amount: 100.5 }).success
    ).toBe(false);
  });

  it("rejects a description longer than 200 characters", () => {
    expect(
      createTransactionSchema.safeParse({
        ...valid,
        description: "a".repeat(201),
      }).success
    ).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  it("accepts an empty (no-op) partial update", () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a description-only update", () => {
    expect(
      updateTransactionSchema.safeParse({ description: "Nota" }).success
    ).toBe(true);
  });

  it("accepts an accountId-only update", () => {
    expect(
      updateTransactionSchema.safeParse({ accountId }).success
    ).toBe(true);
  });
});

describe("listTransactionsQuerySchema", () => {
  it("defaults page and limit when omitted", () => {
    const result = listTransactionsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("coerces string query params to numbers and dates", () => {
    const result = listTransactionsQuerySchema.safeParse({
      page: "2",
      limit: "10",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
      expect(result.data.dateFrom).toBeInstanceOf(Date);
    }
  });

  it("rejects a limit above 100", () => {
    expect(
      listTransactionsQuerySchema.safeParse({ limit: "500" }).success
    ).toBe(false);
  });

  it("rejects an invalid type filter", () => {
    expect(
      listTransactionsQuerySchema.safeParse({ type: "invalid" }).success
    ).toBe(false);
  });

  it("rejects a malformed accountId filter", () => {
    expect(
      listTransactionsQuerySchema.safeParse({ accountId: "not-an-id" })
        .success
    ).toBe(false);
  });
});
