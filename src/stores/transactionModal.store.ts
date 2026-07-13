import { create } from "zustand";

interface TransactionModalState {
  isOpen: boolean;
  editingTransactionId: string | null;
  openCreate: () => void;
  openEdit: (transactionId: string) => void;
  close: () => void;
}

export const useTransactionModalStore = create<TransactionModalState>(
  (set) => ({
    isOpen: false,
    editingTransactionId: null,
    openCreate: () => set({ isOpen: true, editingTransactionId: null }),
    openEdit: (transactionId) =>
      set({ isOpen: true, editingTransactionId: transactionId }),
    close: () => set({ isOpen: false, editingTransactionId: null }),
  })
);
