import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput", () => {
  it("hides the password until the toggle is pressed", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Contraseña" defaultValue="secreto" />);

    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAttribute("type", "password");

    await user.click(
      screen.getByRole("button", { name: /mostrar contraseña/i })
    );
    expect(input).toHaveAttribute("type", "text");

    await user.click(
      screen.getByRole("button", { name: /ocultar contraseña/i })
    );
    expect(input).toHaveAttribute("type", "password");
  });

  it("does not submit the form it sits in", async () => {
    const user = userEvent.setup();
    let submitted = false;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <PasswordInput aria-label="Contraseña" />
      </form>
    );

    await user.click(screen.getByRole("button", { name: /mostrar/i }));
    expect(submitted).toBe(false);
  });
});
