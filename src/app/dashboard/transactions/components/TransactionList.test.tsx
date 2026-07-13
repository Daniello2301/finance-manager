import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionList } from "@/app/dashboard/transactions/components/TransactionList";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useTransactionFiltersStore } from "@/stores/transactionFilters.store";

vi.mock("@/hooks/useTransactions", async () => {
  const actual = await vi.importActual("@/hooks/useTransactions");
  return {
    ...actual,
    useTransactions: vi.fn(),
  };
});

vi.mock("./TransactionRow", () => ({
  TransactionRow: ({ transaction }: { transaction: Transaction }) => (
    <div>{transaction._id}</div>
  ),
}));

const setPage = vi.fn();

vi.mock("@/stores/transactionFilters.store", () => ({
  useTransactionFiltersStore: vi.fn(),
}));

function mockFiltersStore(overrides: Record<string, unknown> = {}) {
  const state = {
    accountId: undefined,
    categoryId: undefined,
    type: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    setPage,
    ...overrides,
  };
  vi.mocked(useTransactionFiltersStore).mockImplementation(
    ((selector: (s: typeof state) => unknown) => selector(state)) as never
  );
}

function mockQueryResult(overrides: Record<string, unknown>) {
  vi.mocked(useTransactions).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("TransactionList", () => {
  it("shows a loading skeleton", () => {
    mockFiltersStore();
    mockQueryResult({ isLoading: true });
    render(<TransactionList />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an error message", () => {
    mockFiltersStore();
    mockQueryResult({ isError: true });
    render(<TransactionList />);
    expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no transactions", () => {
    mockFiltersStore();
    mockQueryResult({
      data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });
    render(<TransactionList />);
    expect(
      screen.getByText(/no hay transacciones que coincidan/i)
    ).toBeInTheDocument();
  });

  it("renders a row per transaction and the pager", () => {
    mockFiltersStore();
    mockQueryResult({
      data: {
        data: [
          { _id: "tx-1" },
          { _id: "tx-2" },
        ],
        pagination: { page: 2, limit: 20, total: 22, totalPages: 3 },
      },
    });
    render(<TransactionList />);
    expect(screen.getByText("tx-1")).toBeInTheDocument();
    expect(screen.getByText("tx-2")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("disables Anterior on the first page and Siguiente on the last page", () => {
    mockFiltersStore();
    mockQueryResult({
      data: {
        data: [{ _id: "tx-1" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
    render(<TransactionList />);
    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });

  it("calls setPage when Siguiente is clicked", async () => {
    mockFiltersStore();
    mockQueryResult({
      data: {
        data: [{ _id: "tx-1" }],
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      },
    });
    const user = userEvent.setup();
    render(<TransactionList />);
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(setPage).toHaveBeenCalledWith(2);
  });
});
