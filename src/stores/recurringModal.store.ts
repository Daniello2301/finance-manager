import { create } from "zustand";

interface RecurringModalState {
  isOpen: boolean;
  editingRecurringId: string | null;
  openCreate: () => void;
  openEdit: (id: string) => void;
  close: () => void;
}

export const useRecurringModalStore = create<RecurringModalState>((set) => ({
  isOpen: false,
  editingRecurringId: null,
  openCreate: () => set({ isOpen: true, editingRecurringId: null }),
  openEdit: (id) => set({ isOpen: true, editingRecurringId: id }),
  close: () => set({ isOpen: false, editingRecurringId: null }),
}));
