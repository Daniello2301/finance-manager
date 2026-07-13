import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signOut, useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

describe("Navbar", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the session is being resolved", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>);

    render(<Navbar />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows login/signup links when unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>);

    render(<Navbar />);
    expect(
      screen.getByRole("link", { name: /iniciar sesión/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /crear cuenta/i })
    ).toBeInTheDocument();
  });

  it("shows the user's name and a logout button when authenticated", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { id: "1", name: "Ana Pérez", email: "ana@example.com" },
        expires: "2026-08-01T00:00:00.000Z",
      },
      status: "authenticated",
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>);

    const user = userEvent.setup();
    render(<Navbar />);

    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
