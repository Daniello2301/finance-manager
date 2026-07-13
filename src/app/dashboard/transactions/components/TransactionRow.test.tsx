import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionRow } from "@/app/dashboard/transactions/components/TransactionRow";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteTransaction, type Transaction } from "@/hooks/useTransactions";
import { useTransactionModalStore } from "@/stores/transactionModal.store";
import { confirmAction } from "@/lib/notifications";

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/useTransactions", async () => {
  const actual = await vi.importActual("@/hooks/useTransactions");
  return {
    ...actual,
    useDeleteTransaction: vi.fn(),
  };
});

vi.mock("@/stores/transactionModal.store", () => ({
  useTransactionModalStore: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  confirmAction: vi.fn(),
}));

const baseTransaction: Transaction = {
  _id: "tx-1",
  userId: "u1",
  accountId: "acc-1",
  categoryId: "cat-1",
  type: "expense",
  amount: 50000,
  currency: "COP",
  date: "2026-07-01T00:00:00.000Z",
  description: "Almuerzo",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("TransactionRow", () => {
  const openEdit = vi.fn();
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAccounts).mockReturnValue({
      data: [{ _id: "acc-1", name: "Ahorros" }],
    } as never);
    vi.mocked(useCategories).mockReturnValue({
      data: [{ _id: "cat-1", name: "Comida" }],
    } as never);
    vi.mocked(useTransactionModalStore).mockImplementation(
      ((selector: (state: { openEdit: typeof openEdit }) => unknown) =>
        selector({ openEdit })) as never
    );
    vi.mocked(useDeleteTransaction).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
  });

  it("shows the category, account, description, and signed amount", () => {
    render(<TransactionRow transaction={baseTransaction} />);
    expect(screen.getByText("Comida")).toBeInTheDocument();
    expect(screen.getByText(/Ahorros/)).toBeInTheDocument();
    expect(screen.getByText("Almuerzo")).toBeInTheDocument();
    expect(screen.getByText(/-\$\s?50\.000/)).toBeInTheDocument();
  });

  it("colors expense amounts with text-negative", () => {
    render(<TransactionRow transaction={baseTransaction} />);
    const amount = screen.getByText(/-\$\s?50\.000/);
    expect(amount).toHaveClass("text-negative");
  });

  it("colors income amounts with text-positive and a plus sign", () => {
    render(
      <TransactionRow
        transaction={{ ...baseTransaction, type: "income", amount: 100000 }}
      />
    );
    const amount = screen.getByText(/\+\$\s?100\.000/);
    expect(amount).toHaveClass("text-positive");
  });

  it("falls back to placeholder labels when account/category are missing", () => {
    vi.mocked(useAccounts).mockReturnValue({ data: [] } as never);
    vi.mocked(useCategories).mockReturnValue({ data: [] } as never);
    render(<TransactionRow transaction={baseTransaction} />);
    expect(screen.getByText("Categoría eliminada")).toBeInTheDocument();
    expect(screen.getByText(/Cuenta eliminada/)).toBeInTheDocument();
  });

  it("calls openEdit with the transaction id when Editar is clicked", async () => {
    const user = userEvent.setup();
    render(<TransactionRow transaction={baseTransaction} />);
    await user.click(screen.getByRole("button", { name: /editar/i }));
    expect(openEdit).toHaveBeenCalledWith("tx-1");
  });

  it("deletes the transaction when the user confirms", async () => {
    vi.mocked(confirmAction).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<TransactionRow transaction={baseTransaction} />);
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(mutate).toHaveBeenCalledWith("tx-1");
  });

  it("does not delete the transaction when the user cancels", async () => {
    vi.mocked(confirmAction).mockResolvedValue(false);
    const user = userEvent.setup();
    render(<TransactionRow transaction={baseTransaction} />);
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(mutate).not.toHaveBeenCalled();
  });
});
