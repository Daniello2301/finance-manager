import { create } from "zustand";

interface BudgetModalState {
  isOpen: boolean;
  editingBudgetId: string | null;
  openCreate: () => void;
  openEdit: (budgetId: string) => void;
  close: () => void;
}

export const useBudgetModalStore = create<BudgetModalState>((set) => ({
  isOpen: false,
  editingBudgetId: null,
  openCreate: () => set({ isOpen: true, editingBudgetId: null }),
  openEdit: (budgetId) => set({ isOpen: true, editingBudgetId: budgetId }),
  close: () => set({ isOpen: false, editingBudgetId: null }),
}));
