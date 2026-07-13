import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/validation/auth";

describe("signupSchema", () => {
  const valid = {
    email: "user@example.com",
    name: "Ana Pérez",
    password: "SecurePass123!",
    confirmPassword: "SecurePass123!",
  };

  it("accepts a valid payload", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = signupSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "email")).toBe(
        true
      );
    }
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(signupSchema.safeParse({ ...valid, name: "A" }).success).toBe(
      false
    );
  });

  it("rejects a password missing an uppercase letter", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "securepass123!",
      confirmPassword: "securepass123!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password missing a digit", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "SecurePass!",
      confirmPassword: "SecurePass!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password missing a special character", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      ...valid,
      password: "Ab1!",
      confirmPassword: "Ab1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirmPassword and flags the right field", () => {
    const result = signupSchema.safeParse({
      ...valid,
      confirmPassword: "Different123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === "confirmPassword")
      ).toBe(true);
    }
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password without strength checks", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "x",
    });
    expect(result.success).toBe(false);
  });
});
