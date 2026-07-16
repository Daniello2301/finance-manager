import { afterEach, describe, expect, it } from "vitest";
import { useRecurringModalStore } from "@/stores/recurringModal.store";

describe("useRecurringModalStore", () => {
  afterEach(() => {
    useRecurringModalStore.setState({ isOpen: false, editingRecurringId: null });
  });

  it("starts closed with nothing being edited", () => {
    const state = useRecurringModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingRecurringId).toBeNull();
  });

  it("openCreate opens in create mode", () => {
    useRecurringModalStore.getState().openCreate();
    const state = useRecurringModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingRecurringId).toBeNull();
  });

  it("openEdit opens with the given id", () => {
    useRecurringModalStore.getState().openEdit("rec-1");
    const state = useRecurringModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingRecurringId).toBe("rec-1");
  });

  it("close resets both fields", () => {
    useRecurringModalStore.getState().openEdit("rec-1");
    useRecurringModalStore.getState().close();
    const state = useRecurringModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingRecurringId).toBeNull();
  });
});
