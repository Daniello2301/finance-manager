import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionFilters } from "@/app/dashboard/transactions/components/TransactionFilters";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTransactionFiltersStore } from "@/stores/transactionFilters.store";

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/stores/transactionFilters.store", () => ({
  useTransactionFiltersStore: vi.fn(),
}));

const setAccountId = vi.fn();
const setCategoryId = vi.fn();
const setType = vi.fn();
const setDateFrom = vi.fn();
const setDateTo = vi.fn();
const clearFilters = vi.fn();

function mockFiltersStore(overrides: Record<string, unknown> = {}) {
  const state = {
    accountId: undefined,
    categoryId: undefined,
    type: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    setAccountId,
    setCategoryId,
    setType,
    setDateFrom,
    setDateTo,
    clearFilters,
    ...overrides,
  };
  vi.mocked(useTransactionFiltersStore).mockImplementation(
    ((selector: (s: typeof state) => unknown) => selector(state)) as never
  );
}

describe("TransactionFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAccounts).mockReturnValue({
      data: [{ _id: "acc-1", name: "Ahorros" }],
    } as never);
    vi.mocked(useCategories).mockReturnValue({
      data: [{ _id: "cat-1", name: "Comida" }],
    } as never);
    mockFiltersStore();
  });

  it("renders account and category options with a 'Todas' default", () => {
    render(<TransactionFilters />);
    expect(screen.getByRole("option", { name: "Ahorros" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Comida" })).toBeInTheDocument();
  });

  it("calls setAccountId when an account is selected", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters />);
    await user.selectOptions(screen.getByLabelText("Cuenta"), "acc-1");
    expect(setAccountId).toHaveBeenCalledWith("acc-1");
  });

  it("calls setType with undefined when 'Todas' is selected", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters />);
    await user.selectOptions(screen.getByLabelText("Tipo"), "expense");
    expect(setType).toHaveBeenCalledWith("expense");
    await user.selectOptions(screen.getByLabelText("Tipo"), "");
    expect(setType).toHaveBeenCalledWith(undefined);
  });

  it("calls setDateFrom and setDateTo when the date inputs change", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters />);
    await user.type(screen.getByLabelText("Desde"), "2026-07-01");
    expect(setDateFrom).toHaveBeenCalled();
    await user.type(screen.getByLabelText("Hasta"), "2026-07-31");
    expect(setDateTo).toHaveBeenCalled();
  });

  it("calls clearFilters when 'Limpiar filtros' is clicked", async () => {
    // Needs a filter set: with nothing to clear the button is disabled.
    mockFiltersStore({ accountId: "acc-1" });
    const user = userEvent.setup();
    render(<TransactionFilters />);
    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
    expect(clearFilters).toHaveBeenCalled();
  });

  it("disables 'Limpiar filtros' when there is nothing to clear", () => {
    render(<TransactionFilters />);
    expect(
      screen.getByRole("button", { name: /limpiar filtros/i })
    ).toBeDisabled();
  });

  // The filters used to be five full-width cells stacked ~390px tall — on a
  // phone they filled the screen and pushed every transaction below the fold.
  it("shows how many filters are active on the collapsed mobile toggle", () => {
    mockFiltersStore({ accountId: "acc-1", type: "expense" });
    render(<TransactionFilters />);
    const toggle = screen.getByRole("button", { name: /^filtros/i });
    expect(toggle).toHaveTextContent("2");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("expands the filters when the toggle is pressed", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters />);
    const toggle = screen.getByRole("button", { name: /^filtros/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
