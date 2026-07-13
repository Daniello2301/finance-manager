import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BudgetList } from "@/app/dashboard/budgets/components/BudgetList";
import { useBudgets, useDeleteBudget, type Budget } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useBudgetModalStore } from "@/stores/budgetModal.store";
import { confirmAction } from "@/lib/notifications";

vi.mock("@/hooks/useBudgets", async () => {
  const actual = await vi.importActual("@/hooks/useBudgets");
  return {
    ...actual,
    useBudgets: vi.fn(),
    useDeleteBudget: vi.fn(),
  };
});

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/stores/budgetModal.store", () => ({
  useBudgetModalStore: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  confirmAction: vi.fn(),
}));

const baseBudget: Budget = {
  _id: "budget-1",
  userId: "u1",
  categoryId: "cat-1",
  periodKey: "2026-07",
  periodStart: "2026-07-01T00:00:00.000Z",
  limitAmount: 600000,
  currency: "COP",
  spentAmount: 450000,
  percentUsed: 75,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function mockBudgetsResult(overrides: Record<string, unknown>) {
  vi.mocked(useBudgets).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("BudgetList", () => {
  const openEdit = vi.fn();
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCategories).mockReturnValue({
      data: [{ _id: "cat-1", name: "Mercado" }],
    } as never);
    vi.mocked(useBudgetModalStore).mockImplementation(
      ((selector: (state: { openEdit: typeof openEdit }) => unknown) =>
        selector({ openEdit })) as never
    );
    vi.mocked(useDeleteBudget).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
  });

  it("shows a loading skeleton", () => {
    mockBudgetsResult({ isLoading: true });
    render(<BudgetList period="2026-07" />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an error message", () => {
    mockBudgetsResult({ isError: true });
    render(<BudgetList period="2026-07" />);
    expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no budgets", () => {
    mockBudgetsResult({ data: [] });
    render(<BudgetList period="2026-07" />);
    expect(
      screen.getByText(/no tienes presupuestos definidos/i)
    ).toBeInTheDocument();
  });

  it("renders the category name and progress for each budget", () => {
    mockBudgetsResult({ data: [baseBudget] });
    render(<BudgetList period="2026-07" />);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText(/450\.000/)).toBeInTheDocument();
  });

  it("falls back to a placeholder when the category no longer exists", () => {
    vi.mocked(useCategories).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    mockBudgetsResult({ data: [baseBudget] });
    render(<BudgetList period="2026-07" />);
    expect(screen.getByText("Categoría eliminada")).toBeInTheDocument();
  });

  it("shows a neutral placeholder, not 'eliminada', while categories are still loading", () => {
    vi.mocked(useCategories).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    mockBudgetsResult({ data: [baseBudget] });
    render(<BudgetList period="2026-07" />);
    expect(screen.queryByText("Categoría eliminada")).not.toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("calls openEdit with the budget id when Editar is clicked", async () => {
    mockBudgetsResult({ data: [baseBudget] });
    const user = userEvent.setup();
    render(<BudgetList period="2026-07" />);
    await user.click(screen.getByRole("button", { name: /editar/i }));
    expect(openEdit).toHaveBeenCalledWith("budget-1");
  });

  it("deletes the budget when the user confirms", async () => {
    mockBudgetsResult({ data: [baseBudget] });
    vi.mocked(confirmAction).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<BudgetList period="2026-07" />);
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(mutate).toHaveBeenCalledWith("budget-1");
  });

  it("does not delete the budget when the user cancels", async () => {
    mockBudgetsResult({ data: [baseBudget] });
    vi.mocked(confirmAction).mockResolvedValue(false);
    const user = userEvent.setup();
    render(<BudgetList period="2026-07" />);
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(mutate).not.toHaveBeenCalled();
  });
});
