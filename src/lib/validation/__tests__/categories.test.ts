import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validation/categories";

describe("createCategorySchema", () => {
  const valid = { name: "Transporte", type: "expense" as const };

  it("accepts a valid payload", () => {
    expect(createCategorySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional color/icon", () => {
    const result = createCategorySchema.safeParse({
      ...valid,
      color: "#FF0000",
      icon: "car",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(
      createCategorySchema.safeParse({ type: "expense" }).success
    ).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(
      createCategorySchema.safeParse({ ...valid, type: "invalid" }).success
    ).toBe(false);
  });

  it("rejects a name longer than 40 characters", () => {
    expect(
      createCategorySchema.safeParse({ ...valid, name: "a".repeat(41) })
        .success
    ).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("accepts an empty (no-op) partial update", () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a name-only update", () => {
    expect(
      updateCategorySchema.safeParse({ name: "Nuevo nombre" }).success
    ).toBe(true);
  });

  it("strips a type key instead of erroring (route rejects it explicitly, not Zod)", () => {
    const result = updateCategorySchema.safeParse({
      name: "X",
      type: "income",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("type" in result.data).toBe(false);
    }
  });
});
