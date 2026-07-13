import { describe, expect, it } from "vitest";
import {
  createDebtPaymentSchema,
  createDebtSchema,
  updateDebtSchema,
} from "@/lib/validation/debts";

describe("createDebtSchema", () => {
  // The whole premise of the module: you register the debt with whatever you
  // know. A schema that demanded more would mean debts that never get recorded.
  it("accepts a debt that is nothing but a name", () => {
    const result = createDebtSchema.safeParse({ name: "ADDI" });
    expect(result.success).toBe(true);
  });

  it("rejects a debt with no name", () => {
    expect(createDebtSchema.safeParse({ principal: 1000 }).success).toBe(false);
    expect(createDebtSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("accepts the full set of optional fields", () => {
    const result = createDebtSchema.safeParse({
      name: "Crédito moto",
      creditor: "Banco X",
      principal: 17_000_000,
      monthlyRate: 0.015,
      installmentAmount: 500_000,
      installmentCount: 24,
      accountNumber: "123-456",
      startDate: "2026-01-01",
    });
    expect(result.success).toBe(true);
  });

  // The rate is a DECIMAL FRACTION, never a percentage. A user (or a bug)
  // sending 1.5 would mean 150% a month — the schema refuses it rather than
  // quietly recording a debt a hundred times worse than the real one.
  it("rejects a rate above 1, which is what a raw percentage would look like", () => {
    expect(
      createDebtSchema.safeParse({ name: "X", monthlyRate: 1.5 }).success
    ).toBe(false);
  });

  it("rejects a negative rate", () => {
    expect(
      createDebtSchema.safeParse({ name: "X", monthlyRate: -0.01 }).success
    ).toBe(false);
  });

  it("rejects a non-integer amount (Principle 9: minor units)", () => {
    expect(
      createDebtSchema.safeParse({ name: "X", principal: 1000.5 }).success
    ).toBe(false);
  });

  it("does not let a debt be created already archived", () => {
    const result = createDebtSchema.safeParse({ name: "X", isArchived: true });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("isArchived");
  });
});

describe("updateDebtSchema", () => {
  // Same trap that made unarchiving silently impossible for accounts and
  // categories: Zod strips unknown keys, so the field has to be declared.
  it("keeps isArchived instead of dropping it", () => {
    const result = updateDebtSchema.safeParse({ isArchived: false });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ isArchived: false });
  });
});

describe("createDebtPaymentSchema", () => {
  const valid = {
    accountId: "6a552b6c453d5835a99f83a2",
    categoryId: "6a552b0be1eb632f39c63cad",
    amount: 255_000,
    date: "2026-01-15",
  };

  it("accepts a valid payment", () => {
    expect(createDebtPaymentSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an account and a category — a payment is a real transaction", () => {
    expect(
      createDebtPaymentSchema.safeParse({ ...valid, accountId: undefined })
        .success
    ).toBe(false);
    expect(
      createDebtPaymentSchema.safeParse({ ...valid, categoryId: undefined })
        .success
    ).toBe(false);
  });

  it("rejects a malformed id before it can reach Mongoose as a CastError", () => {
    expect(
      createDebtPaymentSchema.safeParse({ ...valid, accountId: "abc" }).success
    ).toBe(false);
  });

  it("rejects a zero or negative payment", () => {
    expect(
      createDebtPaymentSchema.safeParse({ ...valid, amount: 0 }).success
    ).toBe(false);
    expect(
      createDebtPaymentSchema.safeParse({ ...valid, amount: -1 }).success
    ).toBe(false);
  });

  it("carries confirmOverdraft, so paying a debt you can't afford still asks", () => {
    const result = createDebtPaymentSchema.safeParse({
      ...valid,
      confirmOverdraft: true,
    });
    expect(result.success).toBe(true);
    expect(result.data?.confirmOverdraft).toBe(true);
  });
});
