import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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

  it("signs out back to the welcome page, not the login form", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(
      screen.getAllByRole("button", { name: /cerrar sesión/i })[0]
    );
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("renders the mobile drawer as an accessible dialog with a proper name", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      /finanzas personales/i
    );
  });

  it("closes the mobile drawer when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  // A phone rotated to landscape (~844px) crosses the `md` breakpoint, at which
  // point the drawer's close button and the hamburger are both gone. Before the
  // fix, the drawer stayed *open* with no way out: backdrop still covering the
  // screen, body scroll locked, focus trapped. Hiding it with CSS was not enough
  // — an invisible dialog is still an open dialog. This drives the real media
  // query rather than asserting on a className.
  it("closes the mobile drawer when the viewport grows past the desktop breakpoint", async () => {
    const listeners: Array<() => void> = [];
    let isDesktop = false;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return isDesktop;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: () => void) => {
        listeners.push(listener);
      },
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Rotate to landscape.
    isDesktop = true;
    act(() => listeners.forEach((listener) => listener()));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
