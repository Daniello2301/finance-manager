import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GoogleButton } from "@/components/forms/GoogleButton";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}));

const params = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useSearchParams: () => params.current,
}));

afterEach(() => {
  vi.clearAllMocks();
  params.current = new URLSearchParams();
});

describe("GoogleButton", () => {
  it("sends the user to Google and back to the dashboard", async () => {
    const user = userEvent.setup();
    render(<GoogleButton />);

    await user.click(screen.getByRole("button", { name: /continuar con google/i }));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/dashboard" });
  });

  it("takes a custom label", () => {
    render(<GoogleButton label="Registrarse con Google" />);
    expect(
      screen.getByRole("button", { name: /registrarse con google/i })
    ).toBeInTheDocument();
  });

  it("says nothing when there is no error", () => {
    render(<GoogleButton />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // The refusal our own signIn callback raises when Google hasn't verified the
  // address (FR-017). Without this the user is bounced back to a login page that
  // silently swallowed the reason.
  it("explains a refused sign-in instead of swallowing it", () => {
    params.current = new URLSearchParams({ error: "AccessDenied" });
    render(<GoogleButton />);

    expect(screen.getByText(/no confirmó que ese correo sea tuyo/i)).toBeInTheDocument();
  });

  it("falls back to a generic message for an unknown error", () => {
    params.current = new URLSearchParams({ error: "Configuration" });
    render(<GoogleButton />);

    expect(screen.getByText(/no se pudo entrar con google/i)).toBeInTheDocument();
  });
});
