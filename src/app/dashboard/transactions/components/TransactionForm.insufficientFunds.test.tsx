import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransactionForm } from "@/app/dashboard/transactions/components/TransactionForm";
import { ApiError } from "@/lib/api-client";
import {
  useCreateTransaction,
  useTransaction,
  useUpdateTransaction,
} from "@/hooks/useTransactions";
import { useAdjustBalance } from "@/hooks/useAccounts";
import { useCreateDebt, useDisburseDebt } from "@/hooks/useDebts";
import { useTransactionModalStore } from "@/stores/transactionModal.store";

vi.mock("@/hooks/useTransactions", () => ({
  useCreateTransaction: vi.fn(),
  useUpdateTransaction: vi.fn(),
  useTransaction: vi.fn(),
}));

vi.mock("@/hooks/useAccounts", () => ({ useAdjustBalance: vi.fn() }));
vi.mock("@/hooks/useDebts", () => ({
  useCreateDebt: vi.fn(),
  useDisburseDebt: vi.fn(),
}));

vi.mock("@/stores/transactionModal.store", () => ({
  useTransactionModalStore: vi.fn(),
}));

vi.mock("@/components/AccountSelect", () => ({
  AccountSelect: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange: (value: string) => void;
  }) => (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Selecciona una cuenta</option>
      <option value="507f1f77bcf86cd799439011">Ahorros</option>
    </select>
  ),
}));

vi.mock("@/components/CategorySelect", () => ({
  CategorySelect: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange: (value: string) => void;
  }) => (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Selecciona una categoría</option>
      <option value="507f1f77bcf86cd799439012">Comida</option>
    </select>
  ),
}));

const ACCOUNT_ID = "507f1f77bcf86cd799439011";
const CATEGORY_ID = "507f1f77bcf86cd799439012";

// The account holds 100.000 and the user is spending 250.000.
const insufficientFunds = new ApiError(422, {
  error: "Saldo insuficiente",
  code: "INSUFFICIENT_FUNDS",
  available: 100_000,
  currency: "COP",
});

/**
 * There is no "registrar de todos modos" any more (ratified 2026-07-14). Money
 * does not appear out of nowhere, so a refused expense opens a fork instead of
 * an escape hatch: the app asks where the money came from.
 */
describe("TransactionForm — insufficient funds", () => {
  let createMutateAsync: ReturnType<typeof vi.fn>;
  let adjustMutateAsync: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockRejectedValue(insufficientFunds);
    adjustMutateAsync = vi.fn().mockResolvedValue({});
    close = vi.fn();

    vi.mocked(useCreateTransaction).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useUpdateTransaction).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useTransaction).mockReturnValue({ data: undefined } as never);
    vi.mocked(useAdjustBalance).mockReturnValue({
      mutateAsync: adjustMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useCreateDebt).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useDisburseDebt).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    vi.mocked(useTransactionModalStore).mockImplementation(
      ((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          isOpen: true,
          editingTransactionId: null,
          openCreate: vi.fn(),
          openEdit: vi.fn(),
          close,
        })) as never
    );
  });

  async function submitAnOverdraft(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText(/cuenta/i), ACCOUNT_ID);
    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    await user.type(screen.getByLabelText(/monto/i), "250000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
  }

  it("refuses the expense and asks where the money came from", async () => {
    const user = userEvent.setup();
    render(<TransactionForm />);

    await submitAnOverdraft(user);

    expect(await screen.findByText("Saldo insuficiente")).toBeInTheDocument();
    expect(screen.getByText(/de dónde salió/i)).toBeInTheDocument();

    // The four exits, and no fifth one that just lets it through.
    expect(screen.getByText("Lo pedí prestado")).toBeInTheDocument();
    expect(screen.getByText("Me equivoqué de cuenta")).toBeInTheDocument();
    expect(screen.getByText("Falta registrar un ingreso")).toBeInTheDocument();
    expect(screen.getByText("El saldo de la app está mal")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /de todos modos|registrarla igual/i })
    ).not.toBeInTheDocument();

    // Written exactly once, and refused. Nothing was forced through.
    expect(createMutateAsync).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  // The gap is the only amount that can be *proven* came from outside: the other
  // 100.000 was already in the account.
  it("proposes a loan for the shortfall, not for the whole expense", async () => {
    const user = userEvent.setup();
    render(<TransactionForm />);

    await submitAnOverdraft(user);
    await user.click(await screen.findByText("Lo pedí prestado"));

    expect(screen.getByLabelText(/cuánto te prestaron/i)).toHaveValue(150_000);
  });

  it("wrong account: closes the fork and leaves the form as it was", async () => {
    const user = userEvent.setup();
    render(<TransactionForm />);

    await submitAnOverdraft(user);
    await user.click(await screen.findByText("Me equivoqué de cuenta"));

    await waitFor(() =>
      expect(screen.queryByText("Saldo insuficiente")).not.toBeInTheDocument()
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText("Nueva transacción")).toBeInTheDocument();
    // What they typed is still there — they only need to pick another account.
    expect(screen.getByLabelText(/monto/i)).toHaveValue(250_000);
  });

  it("Escape dismisses the fork without closing the form", async () => {
    const user = userEvent.setup();
    render(<TransactionForm />);

    await submitAnOverdraft(user);
    await screen.findByText("Saldo insuficiente");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByText("Saldo insuficiente")).not.toBeInTheDocument()
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText("Nueva transacción")).toBeInTheDocument();
  });

  it("once the money is accounted for, the refused expense goes through", async () => {
    const user = userEvent.setup();
    render(<TransactionForm />);

    await submitAnOverdraft(user);
    await user.click(await screen.findByText("El saldo de la app está mal"));

    // The second attempt succeeds: the account now has the money.
    createMutateAsync.mockResolvedValueOnce({});
    await user.click(screen.getByRole("button", { name: /ajustar el saldo/i }));

    await waitFor(() => expect(adjustMutateAsync).toHaveBeenCalled());
    // Retried automatically — the user does not have to retype the expense.
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
});
