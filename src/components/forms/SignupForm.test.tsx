import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SignupForm } from "@/components/forms/SignupForm";

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
  await user.type(screen.getByLabelText(/nombre/i), "Ana Pérez");
  await user.type(screen.getByLabelText(/correo electrónico/i), "ana@example.com");
  await user.type(screen.getByLabelText(/^contraseña$/i), "SecurePass123!");
  await user.type(screen.getByLabelText(/confirmar contraseña/i), "SecurePass123!");
}

describe("SignupForm", () => {
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

  it("renders all fields", () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it("shows client-side validation errors without calling fetch", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/correo electrónico inválido/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("flags a password/confirmPassword mismatch without calling fetch", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Ana Pérez");
    await user.type(screen.getByLabelText(/correo electrónico/i), "ana@example.com");
    await user.type(screen.getByLabelText(/^contraseña$/i), "SecurePass123!");
    await user.type(screen.getByLabelText(/confirmar contraseña/i), "Different123!");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs up, establishes the session, and redirects to /dashboard on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(201, {
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
    render(<SignupForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "ana@example.com",
      password: "SecurePass123!",
    });
  });

  it("shows a specific error if signIn fails right after a successful signup", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(201, {
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
    render(<SignupForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/no pudimos iniciar sesión autom/i)
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("maps 422 field-specific issues from the API to the right field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(422, {
        error: "Datos inválidos",
        issues: [
          { path: ["email"], message: "Correo ya registrado en otro formato" },
        ],
      })
    );

    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/correo ya registrado en otro formato/i)
    ).toBeInTheDocument();
  });

  // The form used to resetField() both password fields on every server-error
  // path. A 409 has nothing to do with the password, so it wiped a perfectly
  // good one and made the user type it again just to change their email.
  it("shows the duplicate-email error and KEEPS what the user typed on 409", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(409, { error: "El correo electrónico ya está en uso" })
    );

    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/el correo electrónico ya está en uso/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveValue(
      "SecurePass123!"
    );
    expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue(
      "SecurePass123!"
    );
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue(
      "ana@example.com"
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows a generic error when the network request fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/no se pudo conectar con el servidor/i)
    ).toBeInTheDocument();
  });
});
