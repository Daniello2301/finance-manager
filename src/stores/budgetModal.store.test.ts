import { afterEach, describe, expect, it } from "vitest";
import { useBudgetModalStore } from "@/stores/budgetModal.store";

describe("useBudgetModalStore", () => {
  afterEach(() => {
    useBudgetModalStore.setState({
      isOpen: false,
      editingBudgetId: null,
    });
  });

  it("starts closed with no budget being edited", () => {
    const state = useBudgetModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingBudgetId).toBeNull();
  });

  it("openCreate opens the modal in create mode", () => {
    useBudgetModalStore.getState().openCreate();
    const state = useBudgetModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingBudgetId).toBeNull();
  });

  it("openEdit opens the modal with the given budget id", () => {
    useBudgetModalStore.getState().openEdit("budget-1");
    const state = useBudgetModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingBudgetId).toBe("budget-1");
  });

  it("close resets both isOpen and editingBudgetId", () => {
    useBudgetModalStore.getState().openEdit("budget-1");
    useBudgetModalStore.getState().close();
    const state = useBudgetModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingBudgetId).toBeNull();
  });
});
