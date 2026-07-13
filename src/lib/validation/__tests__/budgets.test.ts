import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  copyBudgetsSchema,
  createBudgetSchema,
  listBudgetsQuerySchema,
  updateBudgetSchema,
} from "@/lib/validation/budgets";

const categoryId = new mongoose.Types.ObjectId().toString();

describe("createBudgetSchema", () => {
  const valid = { categoryId, periodKey: "2026-07", limitAmount: 600000 };

  it("accepts a valid payload", () => {
    expect(createBudgetSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed categoryId", () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, categoryId: "not-an-id" })
        .success
    ).toBe(false);
  });

  it("rejects a malformed periodKey", () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, periodKey: "2026-7" }).success
    ).toBe(false);
  });

  it("rejects a non-positive limitAmount", () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, limitAmount: 0 }).success
    ).toBe(false);
  });

  it("rejects a non-integer limitAmount", () => {
    expect(
      createBudgetSchema.safeParse({ ...valid, limitAmount: 100.5 }).success
    ).toBe(false);
  });
});

describe("updateBudgetSchema", () => {
  it("accepts a valid limitAmount", () => {
    expect(updateBudgetSchema.safeParse({ limitAmount: 100000 }).success).toBe(
      true
    );
  });

  it("rejects a missing limitAmount", () => {
    expect(updateBudgetSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-positive limitAmount", () => {
    expect(updateBudgetSchema.safeParse({ limitAmount: -1 }).success).toBe(
      false
    );
  });
});

describe("listBudgetsQuerySchema", () => {
  it("accepts a valid period", () => {
    expect(listBudgetsQuerySchema.safeParse({ period: "2026-07" }).success).toBe(
      true
    );
  });

  it("rejects a missing period", () => {
    expect(listBudgetsQuerySchema.safeParse({}).success).toBe(false);
  });

  it("rejects a malformed period", () => {
    expect(
      listBudgetsQuerySchema.safeParse({ period: "July 2026" }).success
    ).toBe(false);
  });
});

describe("copyBudgetsSchema", () => {
  it("accepts valid fromPeriod/toPeriod", () => {
    expect(
      copyBudgetsSchema.safeParse({ fromPeriod: "2026-06", toPeriod: "2026-07" })
        .success
    ).toBe(true);
  });

  it("rejects a malformed toPeriod", () => {
    expect(
      copyBudgetsSchema.safeParse({ fromPeriod: "2026-06", toPeriod: "bad" })
        .success
    ).toBe(false);
  });
});
