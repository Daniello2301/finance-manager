import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebtSummaryWidget } from "@/app/dashboard/components/DebtSummaryWidget";
import { useDebtSummary, type DebtSummary } from "@/hooks/useDebts";

vi.mock("@/hooks/useDebts", () => ({ useDebtSummary: vi.fn() }));

function summary(overrides: Partial<DebtSummary> = {}) {
  vi.mocked(useDebtSummary).mockReturnValue({
    data: {
      monthlyDue: 500_000,
      paidThisMonth: 255_000,
      totalOutstanding: 17_000_000,
      unknownCount: 0,
      debtsInArrears: 0,
      activeCount: 1,
      ...overrides,
    },
    isLoading: false,
    isError: false,
  } as never);
}

describe("DebtSummaryWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading skeleton", () => {
    vi.mocked(useDebtSummary).mockReturnValue({
      isLoading: true,
    } as never);
    render(<DebtSummaryWidget />);
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });

  it("shows the month's instalments, what's been paid, and the total owed", () => {
    summary();
    render(<DebtSummaryWidget />);
    expect(screen.getByText(/500\.000/)).toBeInTheDocument();
    expect(screen.getByText(/255\.000/)).toBeInTheDocument();
    expect(screen.getByText(/17\.000\.000/)).toBeInTheDocument();
  });

  // A total that quietly leaves out the debts it can't compute is a total that
  // lies. The widget has to admit what it's not counting.
  it("says how many debts it could not include in the total", () => {
    summary({ unknownCount: 2 });
    render(<DebtSummaryWidget />);
    expect(
      screen.getByText(/sin contar 2 deudas sin datos suficientes/i)
    ).toBeInTheDocument();
  });

  it("warns when a debt has uncovered interest", () => {
    summary({ debtsInArrears: 1 });
    render(<DebtSummaryWidget />);
    expect(
      screen.getByText(/una deuda tiene intereses sin cubrir/i)
    ).toBeInTheDocument();
  });

  it("says so plainly when there are no debts", () => {
    summary({ activeCount: 0 });
    render(<DebtSummaryWidget />);
    expect(
      screen.getByText(/no tienes deudas registradas/i)
    ).toBeInTheDocument();
  });

  it("shows an error message when the summary fails to load", () => {
    vi.mocked(useDebtSummary).mockReturnValue({
      isLoading: false,
      isError: true,
    } as never);
    render(<DebtSummaryWidget />);
    expect(
      screen.getByText(/no se pudieron cargar tus deudas/i)
    ).toBeInTheDocument();
  });
});
