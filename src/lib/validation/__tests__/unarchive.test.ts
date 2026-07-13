import { describe, expect, it } from "vitest";
import { updateAccountSchema } from "@/lib/validation/accounts";
import { updateCategorySchema } from "@/lib/validation/categories";
import { createAccountSchema } from "@/lib/validation/accounts";
import { objectIdSchema } from "@/lib/validation/common";

/**
 * The bug these lock down: `isArchived` was not in either update schema, and Zod
 * strips unknown keys silently — so `PATCH { isArchived: false }` parsed to `{}`,
 * the route wrote nothing, and the API answered 200. Archiving was a one-way
 * trip and nothing said so.
 */
describe("unarchiving", () => {
  it("keeps isArchived on an account update instead of dropping it", () => {
    const result = updateAccountSchema.safeParse({ isArchived: false });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ isArchived: false });
  });

  it("keeps isArchived on a category update instead of dropping it", () => {
    const result = updateCategorySchema.safeParse({ isArchived: false });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ isArchived: false });
  });

  it("does not let an account be created already archived", () => {
    const result = createAccountSchema.safeParse({
      name: "Efectivo",
      type: "cash",
      currency: "COP",
      initialBalance: 0,
      isArchived: true,
    });
    // Stripped, not rejected — the point is only that it never reaches the DB.
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("isArchived");
  });
});

describe("objectIdSchema", () => {
  it("accepts a real 24-hex id", () => {
    expect(objectIdSchema.safeParse("6a552b6c453d5835a99f83a2").success).toBe(
      true
    );
  });

  it.each(["abc", "", "zzzzzzzzzzzzzzzzzzzzzzzz", "6a552b6c453d5835a99f83a"])(
    "rejects %o, which would otherwise reach Mongoose and throw a CastError (500)",
    (value) => {
      expect(objectIdSchema.safeParse(value).success).toBe(false);
    }
  );
});
