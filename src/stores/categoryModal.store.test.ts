import { afterEach, describe, expect, it } from "vitest";
import { useCategoryModalStore } from "@/stores/categoryModal.store";

describe("useCategoryModalStore", () => {
  afterEach(() => {
    useCategoryModalStore.setState({
      isOpen: false,
      editingCategoryId: null,
    });
  });

  it("starts closed with no category being edited", () => {
    const state = useCategoryModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingCategoryId).toBeNull();
  });

  it("openCreate opens the modal in create mode", () => {
    useCategoryModalStore.getState().openCreate();
    const state = useCategoryModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingCategoryId).toBeNull();
  });

  it("openEdit opens the modal with the given category id", () => {
    useCategoryModalStore.getState().openEdit("abc123");
    const state = useCategoryModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingCategoryId).toBe("abc123");
  });

  it("close resets both isOpen and editingCategoryId", () => {
    useCategoryModalStore.getState().openEdit("abc123");
    useCategoryModalStore.getState().close();
    const state = useCategoryModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.editingCategoryId).toBeNull();
  });
});
