import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

interface ConfirmState {
  pending: ConfirmOptions | null;
  resolve: ((confirmed: boolean) => void) | null;
  /** Raises a confirmation and resolves once the user answers it. */
  request: (options: ConfirmOptions) => Promise<boolean>;
  /** Answers the open confirmation. No-op if there isn't one. */
  settle: (confirmed: boolean) => void;
}

/**
 * The bridge between `confirmAction()` — an imperative, awaited promise
 * consumed mid-`async`-function — and `<ConfirmDialog />`, a declarative
 * component mounted once in `providers.tsx`. The store holds the resolver so
 * the dialog's buttons can settle a promise nobody in React handed them.
 */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,
  resolve: null,
  request: (options) => {
    // A second request while one is open would strand the first promise
    // unsettled forever (its caller is `await`ing it). Cancel it instead.
    const { resolve: previous } = get();
    previous?.(false);

    return new Promise<boolean>((resolve) => {
      set({ pending: options, resolve });
    });
  },
  settle: (confirmed) => {
    const { resolve } = get();
    if (!resolve) return;
    set({ pending: null, resolve: null });
    resolve(confirmed);
  },
}));

/**
 * True while a confirmation is awaiting an answer. Form dialogs that can raise
 * one from inside themselves (the insufficient-funds flow) check this before
 * honouring a close: closing the form there would discard what the user typed,
 * right as they answer a question the form itself asked.
 *
 * Defence in depth, not the primary mechanism. `<ConfirmDialog />` is mounted
 * globally, so it is NOT inside the form's React tree — and base-ui detects
 * dialog nesting by tree position, so it sees two unrelated dialogs rather than
 * a nested pair. In practice the modal AlertDialog traps focus and
 * `stopPropagation`s the Escape before the form's own dismiss handler sees it,
 * so this guard never fires under test. It stays because jsdom is weakest at
 * exactly this (focus, layers, portals) and the failure it prevents — silently
 * eating a half-typed transaction — is worse than two spare lines.
 */
export function isConfirmPending(): boolean {
  return useConfirmStore.getState().pending !== null;
}
