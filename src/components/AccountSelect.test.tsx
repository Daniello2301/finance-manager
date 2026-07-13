import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountSelect } from "@/components/AccountSelect";
import { useAccounts } from "@/hooks/useAccounts";

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
}));

describe("AccountSelect", () => {
  it("lists the active accounts returned by useAccounts", () => {
    vi.mocked(useAccounts).mockReturnValue({
      data: [
        { _id: "1", name: "Ahorros" },
        { _id: "2", name: "Efectivo" },
      ],
      isLoading: false,
    } as never);

    render(<AccountSelect onChange={vi.fn()} />);
    expect(
      screen.getByRole("option", { name: "Ahorros" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Efectivo" })
    ).toBeInTheDocument();
  });

  it("calls onChange with the selected account id", async () => {
    vi.mocked(useAccounts).mockReturnValue({
      data: [
        { _id: "1", name: "Ahorros" },
        { _id: "2", name: "Efectivo" },
      ],
      isLoading: false,
    } as never);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<AccountSelect onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "2");

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("shows a loading placeholder while accounts are being fetched", () => {
    vi.mocked(useAccounts).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<AccountSelect onChange={vi.fn()} />);
    expect(screen.getByText(/cargando cuentas/i)).toBeInTheDocument();
  });
});
