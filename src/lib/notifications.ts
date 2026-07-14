import { Toast } from "@base-ui/react/toast";

import { useConfirmStore, type ConfirmOptions } from "@/stores/confirm.store";

/**
 * A module-level toast manager, handed to `<Toast.Provider>` in
 * `providers.tsx`. This is what lets the three functions below stay plain
 * functions callable from anywhere — a React Query `onError`, a click handler,
 * a `catch` block — instead of hooks that only work inside a component.
 */
export const toastManager = Toast.createToastManager();

export type { ConfirmOptions };

/**
 * Blocks until the user answers. Used for destructive actions (deleting a
 * transaction or a budget) and for confirming an overdraft. Rendered by
 * `<ConfirmDialog />`; see `stores/confirm.store.ts` for how the promise and
 * the component are bridged.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options);
}

export function notifySuccess(message: string): void {
  toastManager.add({ title: message, type: "success", timeout: 4000 });
}

export function notifyError(message: string): void {
  // Errors don't auto-dismiss: the user should not lose the only account of
  // why their action failed just because they looked away.
  toastManager.add({ title: message, type: "error", timeout: 0, priority: "high" });
}

/**
 * The `onError` of every mutation fired from a plain button. Forms show their
 * failures inline (`setError("root")`), but a button has no field to put a
 * message in — before this, archiving, deleting or recomputing simply failed in
 * silence and the user was left believing it had worked.
 *
 * Prefers the message our API sent (an `ApiError` carries `body.error`), and
 * falls back to a caller-supplied one for network failures and the like.
 */
export function notifyErrorFrom(error: unknown, fallback: string): void {
  notifyError(error instanceof Error && error.message ? error.message : fallback);
}
