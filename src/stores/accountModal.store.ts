import { create } from "zustand";

interface AccountModalState {
  isOpen: boolean;
  editingAccountId: string | null;
  openCreate: () => void;
  openEdit: (accountId: string) => void;
  close: () => void;
}

export const useAccountModalStore = create<AccountModalState>((set) => ({
  isOpen: false,
  editingAccountId: null,
  openCreate: () => set({ isOpen: true, editingAccountId: null }),
  openEdit: (accountId) => set({ isOpen: true, editingAccountId: accountId }),
  close: () => set({ isOpen: false, editingAccountId: null }),
}));
