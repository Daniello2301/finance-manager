import { describe, expect, it } from "vitest";
import {
  createAccountSchema,
  updateAccountSchema,
} from "@/lib/validation/accounts";

describe("createAccountSchema", () => {
  const valid = {
    name: "Bancolombia Ahorros",
    type: "bank" as const,
    initialBalance: 500000,
  };

  it("accepts a valid payload and defaults currency to COP", () => {
    const result = createAccountSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("COP");
    }
  });

  it("rejects a missing name", () => {
    const { type, initialBalance } = valid;
    expect(
      createAccountSchema.safeParse({ type, initialBalance }).success
    ).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(
      createAccountSchema.safeParse({ ...valid, type: "invalid" }).success
    ).toBe(false);
  });

  it("rejects a non-integer initialBalance", () => {
    expect(
      createAccountSchema.safeParse({ ...valid, initialBalance: 500000.5 })
        .success
    ).toBe(false);
  });

  it("rejects creditLimit on a non-credit_card account", () => {
    const result = createAccountSchema.safeParse({
      ...valid,
      type: "bank",
      creditLimit: 2000000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === "creditLimit")
      ).toBe(true);
    }
  });

  it("accepts creditLimit on a credit_card account", () => {
    const result = createAccountSchema.safeParse({
      ...valid,
      type: "credit_card",
      creditLimit: 2000000,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateAccountSchema", () => {
  it("accepts an empty (no-op) partial update", () => {
    expect(updateAccountSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a name-only update", () => {
    expect(updateAccountSchema.safeParse({ name: "Nuevo nombre" }).success).toBe(
      true
    );
  });

  it("strips a currency key instead of erroring (route rejects it explicitly, not Zod)", () => {
    const result = updateAccountSchema.safeParse({
      name: "X",
      currency: "USD",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("currency" in result.data).toBe(false);
    }
  });

  it("accepts creditLimit when type is explicitly credit_card in the same payload", () => {
    const result = updateAccountSchema.safeParse({
      type: "credit_card",
      creditLimit: 1000000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts creditLimit alone without a type — the route, not Zod, checks it against the stored account's type", () => {
    const result = updateAccountSchema.safeParse({ creditLimit: 1000000 });
    expect(result.success).toBe(true);
  });
});
