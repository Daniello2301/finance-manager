import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountCard } from "@/app/dashboard/accounts/components/AccountCard";
import {
  useArchiveAccount,
  useRecomputeBalance,
  type Account,
} from "@/hooks/useAccounts";
import { useAccountModalStore } from "@/stores/accountModal.store";

vi.mock("@/hooks/useAccounts", () => ({
  useArchiveAccount: vi.fn(),
  useRecomputeBalance: vi.fn(),
}));

vi.mock("@/stores/accountModal.store", () => ({
  useAccountModalStore: vi.fn(),
}));

const baseAccount: Account = {
  _id: "1",
  userId: "u1",
  name: "Ahorros",
  type: "bank",
  currency: "COP",
  initialBalance: 500000,
  currentBalance: 500000,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AccountCard", () => {
  const openEdit = vi.fn();
  const mutate = vi.fn();
  const recomputeMutate = vi.fn();

  beforeEach(() => {
    vi.mocked(useAccountModalStore).mockImplementation(
      ((selector: (state: { openEdit: typeof openEdit }) => unknown) =>
        selector({ openEdit })) as never
    );
    vi.mocked(useArchiveAccount).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    vi.mocked(useRecomputeBalance).mockReturnValue({
      mutate: recomputeMutate,
      isPending: false,
    } as never);
  });

  it("shows the account name, type, and formatted balance", () => {
    render(<AccountCard account={baseAccount} />);
    expect(screen.getByText("Ahorros")).toBeInTheDocument();
    expect(screen.getByText(/500\.000/)).toBeInTheDocument();
  });

  it("shows available credit for a credit_card account", () => {
    render(
      <AccountCard
        account={{
          ...baseAccount,
          type: "credit_card",
          currentBalance: -300000,
          creditLimit: 2000000,
        }}
      />
    );
    expect(screen.getByText(/Disponible/)).toBeInTheDocument();
    expect(screen.getByText(/1\.700\.000/)).toBeInTheDocument();
  });

  it("does not show available credit for non-credit_card accounts", () => {
    render(<AccountCard account={baseAccount} />);
    expect(screen.queryByText(/Disponible/)).not.toBeInTheDocument();
  });

  it("calls openEdit with the account id when Editar is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountCard account={baseAccount} />);
    await user.click(screen.getByRole("button", { name: /editar/i }));
    expect(openEdit).toHaveBeenCalledWith("1");
  });

  it("calls archive mutate with the account id when Archivar is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountCard account={baseAccount} />);
    await user.click(screen.getByRole("button", { name: /archivar/i }));
    expect(mutate).toHaveBeenCalledWith("1");
  });

  it("calls recompute mutate with the account id when Recalcular saldo is clicked", async () => {
    const user = userEvent.setup();
    render(<AccountCard account={baseAccount} />);
    await user.click(
      screen.getByRole("button", { name: /recalcular saldo/i })
    );
    expect(recomputeMutate).toHaveBeenCalledWith("1");
  });
});
