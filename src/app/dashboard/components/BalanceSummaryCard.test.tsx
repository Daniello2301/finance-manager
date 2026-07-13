import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceSummaryCard } from "@/app/dashboard/components/BalanceSummaryCard";
import { useDashboardSummary } from "@/hooks/useDashboard";

vi.mock("@/hooks/useDashboard", () => ({
  useDashboardSummary: vi.fn(),
}));

function mockSummary(overrides: Record<string, unknown>) {
  vi.mocked(useDashboardSummary).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("BalanceSummaryCard", () => {
  it("shows a loading skeleton", () => {
    mockSummary({ isLoading: true });
    render(<BalanceSummaryCard />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an error message", () => {
    mockSummary({ isError: true });
    render(<BalanceSummaryCard />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no accounts", () => {
    mockSummary({ data: { balances: [], topBudgets: [] } });
    render(<BalanceSummaryCard />);
    expect(screen.getByText(/aún no tienes cuentas/i)).toBeInTheDocument();
  });

  it("shows the formatted balance per currency", () => {
    mockSummary({
      data: { balances: [{ currency: "COP", total: 1300000 }], topBudgets: [] },
    });
    render(<BalanceSummaryCard />);
    expect(screen.getByText(/1\.300\.000/)).toBeInTheDocument();
  });
});
