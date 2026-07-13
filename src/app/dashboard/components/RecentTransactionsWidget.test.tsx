import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentTransactionsWidget } from "@/app/dashboard/components/RecentTransactionsWidget";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useRecentTransactions } from "@/hooks/useDashboard";

vi.mock("@/hooks/useDashboard", () => ({
  useRecentTransactions: vi.fn(),
}));

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

function mockTransactionsResult(overrides: Record<string, unknown>) {
  vi.mocked(useRecentTransactions).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

const baseTransaction = {
  _id: "tx-1",
  accountId: "acc-1",
  categoryId: "cat-1",
  type: "expense" as const,
  amount: 50000,
  currency: "COP",
  date: "2026-07-01T00:00:00.000Z",
};

describe("RecentTransactionsWidget", () => {
  beforeEach(() => {
    vi.mocked(useAccounts).mockReturnValue({
      data: [{ _id: "acc-1", name: "Ahorros" }],
    } as never);
    vi.mocked(useCategories).mockReturnValue({
      data: [{ _id: "cat-1", name: "Mercado" }],
    } as never);
  });

  it("shows a loading skeleton", () => {
    mockTransactionsResult({ isLoading: true });
    render(<RecentTransactionsWidget />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an error message", () => {
    mockTransactionsResult({ isError: true });
    render(<RecentTransactionsWidget />);
    expect(
      screen.getByText(/no se pudieron cargar las transacciones/i)
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no transactions", () => {
    mockTransactionsResult({ data: [] });
    render(<RecentTransactionsWidget />);
    expect(
      screen.getByText(/aún no registras transacciones/i)
    ).toBeInTheDocument();
  });

  it("renders the category, account, and signed amount for each transaction", () => {
    mockTransactionsResult({ data: [baseTransaction] });
    render(<RecentTransactionsWidget />);
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText(/Ahorros/)).toBeInTheDocument();
    expect(screen.getByText(/-\$\s?50\.000/)).toBeInTheDocument();
  });

  it("shows a neutral placeholder, not 'eliminada', while categories/accounts are still loading", () => {
    vi.mocked(useAccounts).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    vi.mocked(useCategories).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    mockTransactionsResult({ data: [baseTransaction] });
    const { container } = render(<RecentTransactionsWidget />);
    expect(screen.queryByText(/eliminada/i)).not.toBeInTheDocument();
    // One placeholder for the category name, one for the account name.
    expect(container.textContent?.match(/…/g)).toHaveLength(2);
  });

  it("links to the full transactions page", () => {
    mockTransactionsResult({ data: [] });
    render(<RecentTransactionsWidget />);
    expect(screen.getByRole("link", { name: /ver todas/i })).toHaveAttribute(
      "href",
      "/dashboard/transactions"
    );
  });
});
