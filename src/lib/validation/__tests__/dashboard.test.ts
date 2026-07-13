import { describe, expect, it } from "vitest";
import {
  categoryBreakdownQuerySchema,
  recentTransactionsQuerySchema,
  trendQuerySchema,
} from "@/lib/validation/dashboard";

describe("trendQuerySchema", () => {
  it("defaults months to 6 when omitted", () => {
    const result = trendQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.months).toBe(6);
    }
  });

  it("coerces a string months value", () => {
    const result = trendQuerySchema.safeParse({ months: "12" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.months).toBe(12);
    }
  });

  it("rejects a months value above 24", () => {
    expect(trendQuerySchema.safeParse({ months: "25" }).success).toBe(false);
  });

  it("rejects a non-positive months value", () => {
    expect(trendQuerySchema.safeParse({ months: "0" }).success).toBe(false);
  });
});

describe("categoryBreakdownQuerySchema", () => {
  it("accepts a valid period", () => {
    expect(
      categoryBreakdownQuerySchema.safeParse({ period: "2026-07" }).success
    ).toBe(true);
  });

  it("rejects a missing period", () => {
    expect(categoryBreakdownQuerySchema.safeParse({}).success).toBe(false);
  });

  it("rejects a malformed period", () => {
    expect(
      categoryBreakdownQuerySchema.safeParse({ period: "July" }).success
    ).toBe(false);
  });
});

describe("recentTransactionsQuerySchema", () => {
  it("defaults limit to 10 when omitted", () => {
    const result = recentTransactionsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it("rejects a limit above 50", () => {
    expect(
      recentTransactionsQuerySchema.safeParse({ limit: "100" }).success
    ).toBe(false);
  });
});
