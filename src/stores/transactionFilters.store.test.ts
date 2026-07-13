import { afterEach, describe, expect, it } from "vitest";
import { useTransactionFiltersStore } from "@/stores/transactionFilters.store";

const initial = {
  accountId: undefined,
  categoryId: undefined,
  type: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  page: 1,
};

describe("useTransactionFiltersStore", () => {
  afterEach(() => {
    useTransactionFiltersStore.setState({ ...initial });
  });

  it("starts with no filters and page 1", () => {
    const state = useTransactionFiltersStore.getState();
    expect(state.accountId).toBeUndefined();
    expect(state.type).toBeUndefined();
    expect(state.page).toBe(1);
  });

  it("setPage does not touch other filters", () => {
    useTransactionFiltersStore.getState().setAccountId("acc-1");
    useTransactionFiltersStore.getState().setPage(3);
    const state = useTransactionFiltersStore.getState();
    expect(state.page).toBe(3);
    expect(state.accountId).toBe("acc-1");
  });

  it.each([
    ["setAccountId", "acc-1"],
    ["setCategoryId", "cat-1"],
    ["setType", "income"],
    ["setDateFrom", "2026-01-01"],
    ["setDateTo", "2026-01-31"],
  ] as const)("%s resets page to 1", (setter, value) => {
    useTransactionFiltersStore.getState().setPage(5);
    useTransactionFiltersStore.getState()[setter](value as never);
    expect(useTransactionFiltersStore.getState().page).toBe(1);
  });

  it("clearFilters resets everything including page", () => {
    useTransactionFiltersStore.getState().setAccountId("acc-1");
    useTransactionFiltersStore.getState().setType("expense");
    useTransactionFiltersStore.getState().setPage(4);

    useTransactionFiltersStore.getState().clearFilters();

    const state = useTransactionFiltersStore.getState();
    expect(state.accountId).toBeUndefined();
    expect(state.type).toBeUndefined();
    expect(state.page).toBe(1);
  });
});
