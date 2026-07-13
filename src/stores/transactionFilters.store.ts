import { create } from "zustand";

interface TransactionFiltersState {
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense";
  dateFrom?: string;
  dateTo?: string;
  page: number;
  setAccountId: (accountId?: string) => void;
  setCategoryId: (categoryId?: string) => void;
  setType: (type?: "income" | "expense") => void;
  setDateFrom: (dateFrom?: string) => void;
  setDateTo: (dateTo?: string) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
}

const initialFilters = {
  accountId: undefined,
  categoryId: undefined,
  type: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  page: 1,
};

export const useTransactionFiltersStore = create<TransactionFiltersState>(
  (set) => ({
    ...initialFilters,
    setAccountId: (accountId) => set({ accountId, page: 1 }),
    setCategoryId: (categoryId) => set({ categoryId, page: 1 }),
    setType: (type) => set({ type, page: 1 }),
    setDateFrom: (dateFrom) => set({ dateFrom, page: 1 }),
    setDateTo: (dateTo) => set({ dateTo, page: 1 }),
    setPage: (page) => set({ page }),
    clearFilters: () => set({ ...initialFilters }),
  })
);
