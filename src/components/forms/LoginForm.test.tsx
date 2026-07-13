import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/forms/LoginForm";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

const push = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/correo electrónico/i), "ana@example.com");
  await user.type(screen.getByLabelText(/^contraseña$/i), "SecurePass123!");
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
  });

  it("shows client-side validation errors without calling fetch", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(
      await screen.findByText(/correo electrónico inválido/i)
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("logs in, establishes the session, and redirects to /dashboard on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        user: { id: "1", email: "ana@example.com", name: "Ana Pérez" },
      })
    );
    vi.mocked(signIn).mockResolvedValueOnce({
      ok: true,
      error: null,
      status: 200,
      url: null,
    });

    const user = userEvent.setup();
    render(<LoginForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "ana@example.com",
      password: "SecurePass123!",
    });
  });

  it("shows a generic error if signIn fails despite a 200 from the API (race condition)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        user: { id: "1", email: "ana@example.com", name: "Ana Pérez" },
      })
    );
    vi.mocked(signIn).mockResolvedValueOnce({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    });

    const user = userEvent.setup();
    render(<LoginForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(
      await screen.findByText(/correo electrónico o contraseña inválidos/i)
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows one generic root-level error for invalid credentials, never on a specific field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, {
        error: "Correo electrónico o contraseña inválidos",
      })
    );

    const user = userEvent.setup();
    render(<LoginForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(
      await screen.findByText(/correo electrónico o contraseña inválidos/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveValue("");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows a generic error when the network request fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    const user = userEvent.setup();
    render(<LoginForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(
      await screen.findByText(/no se pudo conectar con el servidor/i)
    ).toBeInTheDocument();
  });
});
