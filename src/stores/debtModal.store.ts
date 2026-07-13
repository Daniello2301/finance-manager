import { create } from "zustand";

interface DebtModalState {
  isOpen: boolean;
  editingDebtId: string | null;
  /** The debt whose payment form is open, if any. Separate modal. */
  payingDebtId: string | null;
  openCreate: () => void;
  openEdit: (debtId: string) => void;
  openPayment: (debtId: string) => void;
  close: () => void;
}

export const useDebtModalStore = create<DebtModalState>((set) => ({
  isOpen: false,
  editingDebtId: null,
  payingDebtId: null,
  openCreate: () => set({ isOpen: true, editingDebtId: null, payingDebtId: null }),
  openEdit: (debtId) =>
    set({ isOpen: true, editingDebtId: debtId, payingDebtId: null }),
  openPayment: (debtId) =>
    set({ isOpen: false, editingDebtId: null, payingDebtId: debtId }),
  close: () => set({ isOpen: false, editingDebtId: null, payingDebtId: null }),
}));
