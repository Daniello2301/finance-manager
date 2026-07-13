import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordChecklist } from "@/components/forms/PasswordChecklist";
import { signupSchema } from "@/lib/validation/auth";

function statusOf(label: RegExp): string {
  const item = screen.getByText(label).closest("li");
  return item?.textContent ?? "";
}

describe("PasswordChecklist", () => {
  it("marks every rule pending for an empty password", () => {
    render(<PasswordChecklist value="" />);
    expect(statusOf(/8 caracteres/i)).toContain("(pendiente)");
    expect(statusOf(/mayúscula/i)).toContain("(pendiente)");
    expect(statusOf(/número/i)).toContain("(pendiente)");
    expect(statusOf(/símbolo/i)).toContain("(pendiente)");
  });

  it("marks only the rules the password actually satisfies", () => {
    // Long enough and has an uppercase, but no digit and no symbol.
    render(<PasswordChecklist value="Contrasena" />);
    expect(statusOf(/8 caracteres/i)).toContain("(cumplido)");
    expect(statusOf(/mayúscula/i)).toContain("(cumplido)");
    expect(statusOf(/número/i)).toContain("(pendiente)");
    expect(statusOf(/símbolo/i)).toContain("(pendiente)");
  });

  it("marks every rule met for a valid password", () => {
    render(<PasswordChecklist value="Contrasena1." />);
    expect(screen.queryByText("(pendiente)")).not.toBeInTheDocument();
  });

  // The checklist and the schema are both built from PASSWORD_RULES; this is the
  // test that would fail if they ever drifted apart.
  it("agrees with the schema: a password it shows as fully met is accepted", () => {
    const password = "Contrasena1.";
    render(<PasswordChecklist value={password} />);
    expect(screen.queryByText("(pendiente)")).not.toBeInTheDocument();

    const result = signupSchema.safeParse({
      email: "ana@example.com",
      name: "Ana",
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(true);
  });
});
