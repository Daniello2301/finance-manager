import { afterEach, describe, expect, it } from "vitest";
import { useTransactionModalStore } from "@/stores/transactionModal.store";

describe("useTransactionModalStore", () => {
  afterEach(() => {
    useTransactionModalStore.setState({
      isOpen: false,
      editingTransactionId: null,
    });
  });

  it("starts closed with no transaction being edited", () => {
    const state = useTransactionModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingTransactionId).toBeNull();
  });

  it("openCreate opens the modal in create mode", () => {
    useTransactionModalStore.getState().openCreate();
    const state = useTransactionModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingTransactionId).toBeNull();
  });

  it("openEdit opens the modal with the given transaction id", () => {
    useTransactionModalStore.getState().openEdit("tx-1");
    const state = useTransactionModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingTransactionId).toBe("tx-1");
  });

  it("close resets both isOpen and editingTransactionId", () => {
    useTransactionModalStore.getState().openEdit("tx-1");
    useTransactionModalStore.getState().close();
    const state = useTransactionModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingTransactionId).toBeNull();
  });
});
