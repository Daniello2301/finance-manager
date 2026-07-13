import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm } from "@/app/dashboard/transactions/components/TransactionForm";
import {
  useCreateTransaction,
  useTransaction,
  useUpdateTransaction,
} from "@/hooks/useTransactions";
import { useTransactionModalStore } from "@/stores/transactionModal.store";

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
      <option value="507f1f77bcf86cd799439013">Salario</option>
    </select>
  ),
}));

const ACCOUNT_ID = "507f1f77bcf86cd799439011";
const CATEGORY_ID = "507f1f77bcf86cd799439012";

const existingTransaction = {
  _id: "tx-1",
  userId: "u1",
  accountId: ACCOUNT_ID,
  categoryId: CATEGORY_ID,
  type: "expense" as const,
  amount: 75000,
  currency: "COP",
  date: "2026-07-05T00:00:00.000Z",
  description: "Mercado",
  createdAt: "",
  updatedAt: "",
};

interface StoreOverrides {
  isOpen?: boolean;
  editingTransactionId?: string | null;
  close?: ReturnType<typeof vi.fn>;
}

function mockStore(overrides: StoreOverrides) {
  const close = overrides.close ?? vi.fn();
  vi.mocked(useTransactionModalStore).mockImplementation(
    ((selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isOpen: overrides.isOpen ?? true,
        editingTransactionId: overrides.editingTransactionId ?? null,
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        close,
      })) as never
  );
  return { close };
}

describe("TransactionForm", () => {
  let createMutateAsync: ReturnType<typeof vi.fn>;
  let updateMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockResolvedValue({});
    updateMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreateTransaction).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useUpdateTransaction).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTransaction).mockReturnValue({ data: undefined } as never);
  });

  it("renders the create form defaulting to type Gasto", () => {
    mockStore({ isOpen: true, editingTransactionId: null });
    render(<TransactionForm />);

    expect(screen.getByText("Nueva transacción")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gasto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingreso" })).toBeInTheDocument();
    expect(screen.getByLabelText(/cuenta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument();
  });

  it("clears the selected category when the type toggle changes", async () => {
    mockStore({ isOpen: true, editingTransactionId: null });
    const user = userEvent.setup();
    render(<TransactionForm />);

    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    expect(screen.getByLabelText(/categoría/i)).toHaveValue(CATEGORY_ID);

    await user.click(screen.getByRole("button", { name: "Ingreso" }));
    expect(screen.getByLabelText(/categoría/i)).toHaveValue("");
  });

  it("creates a transaction with minor-unit converted amount and closes on success", async () => {
    const { close } = mockStore({ isOpen: true, editingTransactionId: null });
    const user = userEvent.setup();
    render(<TransactionForm />);

    await user.selectOptions(screen.getByLabelText(/cuenta/i), ACCOUNT_ID);
    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    await user.clear(screen.getByLabelText(/monto/i));
    await user.type(screen.getByLabelText(/monto/i), "50000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        type: "expense",
        amount: 50000,
        date: expect.any(Date),
      })
    );
    expect(close).toHaveBeenCalled();
  });

  it("pre-fills the form in edit mode from the fetched transaction", async () => {
    mockStore({ isOpen: true, editingTransactionId: "tx-1" });
    vi.mocked(useTransaction).mockReturnValue({
      data: existingTransaction,
    } as never);
    render(<TransactionForm />);

    expect(screen.getByText("Editar transacción")).toBeInTheDocument();
    expect(screen.getByLabelText(/cuenta/i)).toHaveValue(ACCOUNT_ID);
    expect(screen.getByLabelText(/categoría/i)).toHaveValue(CATEGORY_ID);
    expect(screen.getByLabelText(/monto/i)).toHaveValue(75000);
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Mercado");
  });

  it("updates a transaction and sends the id separately from the input", async () => {
    const { close } = mockStore({
      isOpen: true,
      editingTransactionId: "tx-1",
    });
    vi.mocked(useTransaction).mockReturnValue({
      data: existingTransaction,
    } as never);
    const user = userEvent.setup();
    render(<TransactionForm />);

    await user.clear(screen.getByLabelText(/monto/i));
    await user.type(screen.getByLabelText(/monto/i), "80000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    const call = updateMutateAsync.mock.calls[0][0];
    expect(call.id).toBe("tx-1");
    expect(call.input.amount).toBe(80000);
    expect(close).toHaveBeenCalled();
  });

  it("shows a root error and does not close when the mutation fails", async () => {
    const { close } = mockStore({ isOpen: true, editingTransactionId: null });
    createMutateAsync.mockRejectedValueOnce(new Error("Falló la creación"));
    const user = userEvent.setup();
    render(<TransactionForm />);

    await user.selectOptions(screen.getByLabelText(/cuenta/i), ACCOUNT_ID);
    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    await user.clear(screen.getByLabelText(/monto/i));
    await user.type(screen.getByLabelText(/monto/i), "1000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/falló la creación/i)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
