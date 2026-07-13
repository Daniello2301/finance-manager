import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetForm } from "@/app/dashboard/budgets/components/BudgetForm";
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
} from "@/hooks/useBudgets";
import { useBudgetModalStore } from "@/stores/budgetModal.store";

vi.mock("@/hooks/useBudgets", async () => {
  const actual = await vi.importActual("@/hooks/useBudgets");
  return {
    ...actual,
    useBudgets: vi.fn(),
    useCreateBudget: vi.fn(),
    useUpdateBudget: vi.fn(),
  };
});

vi.mock("@/stores/budgetModal.store", () => ({
  useBudgetModalStore: vi.fn(),
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
      <option value="507f1f77bcf86cd799439012">Mercado</option>
    </select>
  ),
}));

const CATEGORY_ID = "507f1f77bcf86cd799439012";

const existingBudget = {
  _id: "budget-1",
  userId: "u1",
  categoryId: CATEGORY_ID,
  periodKey: "2026-07",
  periodStart: "2026-07-01T00:00:00.000Z",
  limitAmount: 600000,
  currency: "COP",
  spentAmount: 450000,
  percentUsed: 75,
  createdAt: "",
  updatedAt: "",
};

interface StoreOverrides {
  isOpen?: boolean;
  editingBudgetId?: string | null;
  close?: ReturnType<typeof vi.fn>;
}

function mockStore(overrides: StoreOverrides) {
  const close = overrides.close ?? vi.fn();
  vi.mocked(useBudgetModalStore).mockImplementation(
    ((selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isOpen: overrides.isOpen ?? true,
        editingBudgetId: overrides.editingBudgetId ?? null,
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        close,
      })) as never
  );
  return { close };
}

describe("BudgetForm", () => {
  let createMutateAsync: ReturnType<typeof vi.fn>;
  let updateMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockResolvedValue({});
    updateMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreateBudget).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useUpdateBudget).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useBudgets).mockReturnValue({ data: [] } as never);
  });

  it("renders the create form with a category selector", () => {
    mockStore({ isOpen: true, editingBudgetId: null });
    render(<BudgetForm period="2026-07" />);

    expect(screen.getByText("Nuevo presupuesto")).toBeInTheDocument();
    expect(screen.getByLabelText(/categoría/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/límite mensual/i)).toBeInTheDocument();
  });

  it("creates a budget for the current period and closes on success", async () => {
    const { close } = mockStore({ isOpen: true, editingBudgetId: null });
    const user = userEvent.setup();
    render(<BudgetForm period="2026-07" />);

    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    await user.clear(screen.getByLabelText(/límite mensual/i));
    await user.type(screen.getByLabelText(/límite mensual/i), "600000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync).toHaveBeenCalledWith({
      categoryId: CATEGORY_ID,
      periodKey: "2026-07",
      limitAmount: 600000,
    });
    expect(close).toHaveBeenCalled();
  });

  it("pre-fills the form in edit mode and hides the category selector", () => {
    mockStore({ isOpen: true, editingBudgetId: "budget-1" });
    vi.mocked(useBudgets).mockReturnValue({
      data: [existingBudget],
    } as never);
    render(<BudgetForm period="2026-07" />);

    expect(screen.getByText("Editar presupuesto")).toBeInTheDocument();
    expect(screen.queryByLabelText(/categoría/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/límite mensual/i)).toHaveValue(600000);
  });

  it("updates only the limitAmount and closes on success", async () => {
    const { close } = mockStore({
      isOpen: true,
      editingBudgetId: "budget-1",
    });
    vi.mocked(useBudgets).mockReturnValue({
      data: [existingBudget],
    } as never);
    const user = userEvent.setup();
    render(<BudgetForm period="2026-07" />);

    await user.clear(screen.getByLabelText(/límite mensual/i));
    await user.type(screen.getByLabelText(/límite mensual/i), "750000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: "budget-1",
      input: { limitAmount: 750000 },
    });
    expect(close).toHaveBeenCalled();
  });

  it("does not reset an in-progress edit when the budgets query refetches in the background", async () => {
    mockStore({ isOpen: true, editingBudgetId: "budget-1" });
    vi.mocked(useBudgets).mockReturnValue({ data: [existingBudget] } as never);
    const user = userEvent.setup();
    const { rerender } = render(<BudgetForm period="2026-07" />);

    await user.clear(screen.getByLabelText(/límite mensual/i));
    await user.type(screen.getByLabelText(/límite mensual/i), "999999");
    expect(screen.getByLabelText(/límite mensual/i)).toHaveValue(999999);

    // Same budget id, but a new object/array reference and different
    // server-computed fields — simulates a React Query background refetch
    // (useBudgets has no staleTime) while the modal stays open.
    vi.mocked(useBudgets).mockReturnValue({
      data: [{ ...existingBudget, spentAmount: 500000, percentUsed: 83 }],
    } as never);
    rerender(<BudgetForm period="2026-07" />);

    expect(screen.getByLabelText(/límite mensual/i)).toHaveValue(999999);
  });

  it("shows a root error and does not close when the mutation fails", async () => {
    const { close } = mockStore({ isOpen: true, editingBudgetId: null });
    createMutateAsync.mockRejectedValueOnce(new Error("Falló la creación"));
    const user = userEvent.setup();
    render(<BudgetForm period="2026-07" />);

    await user.selectOptions(screen.getByLabelText(/categoría/i), CATEGORY_ID);
    await user.clear(screen.getByLabelText(/límite mensual/i));
    await user.type(screen.getByLabelText(/límite mensual/i), "1000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/falló la creación/i)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
