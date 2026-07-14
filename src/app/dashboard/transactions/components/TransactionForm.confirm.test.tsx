import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransactionForm } from "@/app/dashboard/transactions/components/TransactionForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ApiError } from "@/lib/api-client";
import {
  useCreateTransaction,
  useTransaction,
  useUpdateTransaction,
} from "@/hooks/useTransactions";
import { useTransactionModalStore } from "@/stores/transactionModal.store";
import { useConfirmStore } from "@/stores/confirm.store";

vi.mock("@/hooks/useTransactions", () => ({
  useCreateTransaction: vi.fn(),
  useUpdateTransaction: vi.fn(),
  useTransaction: vi.fn(),
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

const insufficientFunds = new ApiError(422, {
  error: "Saldo insuficiente",
  code: "INSUFFICIENT_FUNDS",
  available: 100000,
  currency: "COP",
});

/**
 * `<ConfirmDialog />` lives in `providers.tsx`, i.e. OUTSIDE the form's React
 * tree — exactly as in the real app. That's the whole point of these tests: it
 * means base-ui sees two unrelated top-of-stack dialogs, not a nested pair.
 */
function renderFormWithConfirm() {
  return render(
    <>
      <TransactionForm />
      <ConfirmDialog />
    </>
  );
}

describe("TransactionForm — insufficient-funds confirmation", () => {
  let createMutateAsync: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockRejectedValue(insufficientFunds);
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

  afterEach(() => {
    useConfirmStore.setState({ pending: null, resolve: null });
  });

  async function submitAnOverdraft(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText(/cuenta/i), ACCOUNT_ID);
    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    await user.type(screen.getByLabelText(/monto/i), "250000");
    await user.click(screen.getByRole("button", { name: /guardar|crear/i }));
  }

  it("raises the confirmation on top of the still-open form, quoting the balance", async () => {
    const user = userEvent.setup();
    renderFormWithConfirm();

    await submitAnOverdraft(user);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Saldo insuficiente")).toBeInTheDocument();
    expect(
      screen.getByText(/¿Registrar la transacción de todos modos\?/)
    ).toBeInTheDocument();
    // The form is still there underneath.
    expect(screen.getByText("Nueva transacción")).toBeInTheDocument();
  });

  // The regression this whole guard exists for. Without it, one Escape closes
  // the confirmation AND the form beneath it, throwing away what was typed.
  it("Escape dismisses the confirmation without closing the form", async () => {
    const user = userEvent.setup();
    renderFormWithConfirm();

    await submitAnOverdraft(user);
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText("Nueva transacción")).toBeInTheDocument();
  });

  it("cancelling leaves the form open and does not retry the write", async () => {
    const user = userEvent.setup();
    renderFormWithConfirm();

    await submitAnOverdraft(user);
    await user.click(
      await screen.findByRole("button", { name: "Cancelar" })
    );

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText("Nueva transacción")).toBeInTheDocument();
  });

  it("confirming retries the write with confirmOverdraft and closes the form", async () => {
    const user = userEvent.setup();
    // First call rejects (the server refuses), the retry succeeds.
    createMutateAsync
      .mockRejectedValueOnce(insufficientFunds)
      .mockResolvedValueOnce({});
    renderFormWithConfirm();

    await submitAnOverdraft(user);
    await user.click(
      await screen.findByRole("button", { name: "Sí, registrarla" })
    );

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(2));
    expect(createMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmOverdraft: true })
    );
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
});
