import { create } from "zustand";

interface CategoryModalState {
  isOpen: boolean;
  editingCategoryId: string | null;
  openCreate: () => void;
  openEdit: (categoryId: string) => void;
  close: () => void;
}

export const useCategoryModalStore = create<CategoryModalState>((set) => ({
  isOpen: false,
  editingCategoryId: null,
  openCreate: () => set({ isOpen: true, editingCategoryId: null }),
  openEdit: (categoryId) =>
    set({ isOpen: true, editingCategoryId: categoryId }),
  close: () => set({ isOpen: false, editingCategoryId: null }),
}));
