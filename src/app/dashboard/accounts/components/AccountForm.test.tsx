import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountForm } from "@/app/dashboard/accounts/components/AccountForm";
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
} from "@/hooks/useAccounts";
import { useAccountModalStore } from "@/stores/accountModal.store";

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
  useCreateAccount: vi.fn(),
  useUpdateAccount: vi.fn(),
}));

vi.mock("@/stores/accountModal.store", () => ({
  useAccountModalStore: vi.fn(),
}));

const existingAccount = {
  _id: "acc-1",
  userId: "u1",
  name: "Tarjeta Visa",
  type: "credit_card" as const,
  currency: "COP",
  initialBalance: 0,
  currentBalance: -50000,
  creditLimit: 2000000,
  isArchived: false,
  createdAt: "",
  updatedAt: "",
};

interface StoreOverrides {
  isOpen?: boolean;
  editingAccountId?: string | null;
  close?: ReturnType<typeof vi.fn>;
}

function mockStore(overrides: StoreOverrides) {
  const close = overrides.close ?? vi.fn();
  vi.mocked(useAccountModalStore).mockImplementation(
    ((selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isOpen: overrides.isOpen ?? true,
        editingAccountId: overrides.editingAccountId ?? null,
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        close,
      })) as never
  );
  return { close };
}

describe("AccountForm", () => {
  let createMutateAsync: ReturnType<typeof vi.fn>;
  let updateMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockResolvedValue({});
    updateMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreateAccount).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useUpdateAccount).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useAccounts).mockReturnValue({
      data: [existingAccount],
    } as never);
  });

  it("renders the create form with no creditLimit field by default", () => {
    mockStore({ isOpen: true, editingAccountId: null });
    render(<AccountForm />);

    expect(screen.getByText("Nueva cuenta")).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/saldo inicial/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/límite de crédito/i)
    ).not.toBeInTheDocument();
  });

  it("reveals the creditLimit field when type is set to credit_card", async () => {
    mockStore({ isOpen: true, editingAccountId: null });
    const user = userEvent.setup();
    render(<AccountForm />);

    await user.selectOptions(screen.getByLabelText(/tipo/i), "credit_card");
    expect(screen.getByLabelText(/límite de crédito/i)).toBeInTheDocument();
  });

  it("creates an account with minor-unit converted amounts and closes on success", async () => {
    const { close } = mockStore({ isOpen: true, editingAccountId: null });
    const user = userEvent.setup();
    render(<AccountForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Bancolombia");
    await user.clear(screen.getByLabelText(/saldo inicial/i));
    await user.type(screen.getByLabelText(/saldo inicial/i), "500000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bancolombia",
        type: "bank",
        currency: "COP",
        initialBalance: 500000,
      })
    );
    expect(close).toHaveBeenCalled();
  });

  it("pre-fills the form in edit mode and never sends currency or initialBalance", async () => {
    const { close } = mockStore({
      isOpen: true,
      editingAccountId: "acc-1",
    });
    const user = userEvent.setup();
    render(<AccountForm />);

    expect(screen.getByText("Editar cuenta")).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Tarjeta Visa");
    expect(screen.queryByLabelText(/saldo inicial/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    const call = updateMutateAsync.mock.calls[0][0];
    expect(call.id).toBe("acc-1");
    expect(call.input).not.toHaveProperty("currency");
    expect(call.input).not.toHaveProperty("initialBalance");
    expect(close).toHaveBeenCalled();
  });

  // An empty number input read with `valueAsNumber` yields NaN, and NaN IS a
  // number — so Zod's `.optional()` doesn't save you and `.int()` rejects it.
  // The form then refuses to submit, with an error on a field the user chose to
  // leave blank. This is what made a credit card with no billing cycle (the
  // owner's, today) impossible to save.
  it("saves a card whose optional number fields are left blank", async () => {
    const { close } = mockStore({ isOpen: true, editingAccountId: "acc-1" });
    const user = userEvent.setup();
    render(<AccountForm />);

    // The card has no cycle: both day fields render empty.
    expect(screen.getByLabelText(/día de corte/i)).toHaveValue(null);
    expect(screen.getByLabelText(/día de pago/i)).toHaveValue(null);

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    const { input } = updateMutateAsync.mock.calls[0][0];
    // Left blank means absent, not NaN and not zero.
    expect(input).not.toHaveProperty("statementDay");
    expect(input).not.toHaveProperty("paymentDay");
    expect(close).toHaveBeenCalled();
  });

  it("saves the billing cycle when both days are given", async () => {
    mockStore({ isOpen: true, editingAccountId: "acc-1" });
    const user = userEvent.setup();
    render(<AccountForm />);

    await user.type(screen.getByLabelText(/día de corte/i), "20");
    await user.type(screen.getByLabelText(/día de pago/i), "5");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    const { input } = updateMutateAsync.mock.calls[0][0];
    expect(input.statementDay).toBe(20);
    expect(input.paymentDay).toBe(5);
  });

  it("shows a root error and does not close when the mutation fails", async () => {
    const { close } = mockStore({ isOpen: true, editingAccountId: null });
    createMutateAsync.mockRejectedValueOnce(new Error("Falló la creación"));
    const user = userEvent.setup();
    render(<AccountForm />);

    await user.type(screen.getByLabelText(/nombre/i), "X");
    await user.clear(screen.getByLabelText(/saldo inicial/i));
    await user.type(screen.getByLabelText(/saldo inicial/i), "0");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/falló la creación/i)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
