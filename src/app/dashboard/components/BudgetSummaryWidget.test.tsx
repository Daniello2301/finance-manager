import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetSummaryWidget } from "@/app/dashboard/components/BudgetSummaryWidget";
import { useCategories } from "@/hooks/useCategories";
import { useDashboardSummary } from "@/hooks/useDashboard";

vi.mock("@/hooks/useDashboard", () => ({
  useDashboardSummary: vi.fn(),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

function mockSummary(overrides: Record<string, unknown>) {
  vi.mocked(useDashboardSummary).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("BudgetSummaryWidget", () => {
  it("shows a loading message", () => {
    vi.mocked(useCategories).mockReturnValue({ data: [] } as never);
    mockSummary({ isLoading: true });
    render(<BudgetSummaryWidget />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("shows an error message", () => {
    vi.mocked(useCategories).mockReturnValue({ data: [] } as never);
    mockSummary({ isError: true });
    render(<BudgetSummaryWidget />);
    expect(
      screen.getByText(/no se pudieron cargar los presupuestos/i)
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no budgets this month", () => {
    vi.mocked(useCategories).mockReturnValue({ data: [] } as never);
    mockSummary({ data: { balances: [], topBudgets: [] } });
    render(<BudgetSummaryWidget />);
    expect(
      screen.getByText(/no tienes presupuestos definidos/i)
    ).toBeInTheDocument();
  });

  it("renders the category name and progress for each top budget", () => {
    vi.mocked(useCategories).mockReturnValue({
      data: [{ _id: "cat-1", name: "Mercado" }],
    } as never);
    mockSummary({
      data: {
        balances: [],
        topBudgets: [
          {
            _id: "budget-1",
            categoryId: "cat-1",
            limitAmount: 600000,
            currency: "COP",
            spentAmount: 450000,
            percentUsed: 75,
          },
        ],
      },
    });
    render(<BudgetSummaryWidget />);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText(/450\.000/)).toBeInTheDocument();
  });

  it("links to the full budgets page", () => {
    vi.mocked(useCategories).mockReturnValue({ data: [] } as never);
    mockSummary({ data: { balances: [], topBudgets: [] } });
    render(<BudgetSummaryWidget />);
    expect(screen.getByRole("link", { name: /ver todos/i })).toHaveAttribute(
      "href",
      "/dashboard/budgets"
    );
  });
});
