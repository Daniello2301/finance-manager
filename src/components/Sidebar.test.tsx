import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/accounts");
    vi.mocked(useSession).mockReturnValue({
      data: { user: { name: "Ana", email: "ana@example.com" } },
      status: "authenticated",
    } as never);
  });

  it("renders a link for every dashboard section", () => {
    render(<Sidebar />);
    expect(
      screen.getAllByRole("link", { name: /panel/i })[0]
    ).toHaveAttribute("href", "/dashboard");
    expect(
      screen.getAllByRole("link", { name: /cuentas/i })[0]
    ).toHaveAttribute("href", "/dashboard/accounts");
    expect(
      screen.getAllByRole("link", { name: /categorías/i })[0]
    ).toHaveAttribute("href", "/dashboard/categories");
    expect(
      screen.getAllByRole("link", { name: /transacciones/i })[0]
    ).toHaveAttribute("href", "/dashboard/transactions");
    expect(
      screen.getAllByRole("link", { name: /presupuestos/i })[0]
    ).toHaveAttribute("href", "/dashboard/budgets");
  });

  it("marks the item matching the current path as active", () => {
    render(<Sidebar />);
    const links = screen.getAllByRole("link", { name: /cuentas/i });
    const activeLink = links.find(
      (link) => link.getAttribute("aria-current") === "page"
    );
    expect(activeLink).toBeDefined();
  });

  it("does not mark other items as active", () => {
    render(<Sidebar />);
    const links = screen.getAllByRole("link", { name: /presupuestos/i });
    expect(
      links.every((link) => link.getAttribute("aria-current") !== "page")
    ).toBe(true);
  });

  it("shows the signed-in user's name", () => {
    render(<Sidebar />);
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
  });

  it("calls signOut when 'Cerrar sesión' is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(
      screen.getAllByRole("button", { name: /cerrar sesión/i })[0]
    );
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("opens and closes the mobile drawer", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    expect(
      screen.queryByRole("button", { name: /cerrar menú/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(
      screen.getByRole("button", { name: /cerrar menú/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cerrar menú/i }));
    expect(
      screen.queryByRole("button", { name: /cerrar menú/i })
    ).not.toBeInTheDocument();
  });

  it("closes the mobile drawer after clicking a nav link", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    // The drawer's own nav renders before the (CSS-hidden) desktop aside in
    // DOM order, so the first "Panel" link belongs to the open drawer.
    const drawerLinks = screen.getAllByRole("link", { name: /panel/i });
    await user.click(drawerLinks[0]);

    expect(
      screen.queryByRole("button", { name: /cerrar menú/i })
    ).not.toBeInTheDocument();
  });
});
