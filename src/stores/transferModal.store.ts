import { create } from "zustand";

interface TransferModalState {
  isOpen: boolean;
  /** Prefilled when opened from a card's "Pagar tarjeta". */
  toAccountId?: string;
  /** Prefilled with what that card's statement demands, in major units. */
  amount?: number;
  open: (prefill?: { toAccountId?: string; amount?: number }) => void;
  close: () => void;
}

export const useTransferModalStore = create<TransferModalState>((set) => ({
  isOpen: false,
  toAccountId: undefined,
  amount: undefined,
  open: (prefill) =>
    set({
      isOpen: true,
      toAccountId: prefill?.toAccountId,
      amount: prefill?.amount,
    }),
  close: () => set({ isOpen: false, toAccountId: undefined, amount: undefined }),
}));
