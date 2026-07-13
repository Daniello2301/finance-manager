import { afterEach, describe, expect, it } from "vitest";
import { useAccountModalStore } from "@/stores/accountModal.store";

describe("useAccountModalStore", () => {
  afterEach(() => {
    useAccountModalStore.setState({ isOpen: false, editingAccountId: null });
  });

  it("starts closed with no account being edited", () => {
    const state = useAccountModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingAccountId).toBeNull();
  });

  it("openCreate opens the modal in create mode", () => {
    useAccountModalStore.getState().openCreate();
    const state = useAccountModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingAccountId).toBeNull();
  });

  it("openEdit opens the modal with the given account id", () => {
    useAccountModalStore.getState().openEdit("abc123");
    const state = useAccountModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingAccountId).toBe("abc123");
  });

  it("close resets both isOpen and editingAccountId", () => {
    useAccountModalStore.getState().openEdit("abc123");
    useAccountModalStore.getState().close();
    const state = useAccountModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingAccountId).toBeNull();
  });
});
