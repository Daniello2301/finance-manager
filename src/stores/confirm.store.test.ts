import { afterEach, describe, expect, it } from "vitest";
import { useConfirmStore } from "@/stores/confirm.store";

describe("useConfirmStore", () => {
  afterEach(() => {
    useConfirmStore.setState({ pending: null, resolve: null });
  });

  it("starts with nothing pending", () => {
    const state = useConfirmStore.getState();
    expect(state.pending).toBeNull();
    expect(state.resolve).toBeNull();
  });

  it("request stores the options and keeps the promise unsettled", async () => {
    const promise = useConfirmStore.getState().request({ title: "¿Borrar?" });

    const state = useConfirmStore.getState();
    expect(state.pending).toEqual({ title: "¿Borrar?" });
    expect(state.resolve).toBeInstanceOf(Function);

    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("settle(true) resolves the pending promise with true and clears state", async () => {
    const promise = useConfirmStore.getState().request({ title: "¿Borrar?" });
    useConfirmStore.getState().settle(true);

    await expect(promise).resolves.toBe(true);
    const state = useConfirmStore.getState();
    expect(state.pending).toBeNull();
    expect(state.resolve).toBeNull();
  });

  it("settle(false) resolves the pending promise with false", async () => {
    const promise = useConfirmStore.getState().request({ title: "¿Borrar?" });
    useConfirmStore.getState().settle(false);

    await expect(promise).resolves.toBe(false);
  });

  it("settle without a pending confirmation is a no-op", () => {
    expect(() => useConfirmStore.getState().settle(true)).not.toThrow();
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  // A caller is `await`ing every promise `request()` hands out. If a second
  // request simply overwrote the first resolver, the first caller would hang
  // forever — so the superseded one must be answered (as a cancel).
  it("a second request cancels the first instead of stranding its promise", async () => {
    const first = useConfirmStore.getState().request({ title: "Primera" });
    const second = useConfirmStore.getState().request({ title: "Segunda" });

    await expect(first).resolves.toBe(false);
    expect(useConfirmStore.getState().pending).toEqual({ title: "Segunda" });

    useConfirmStore.getState().settle(true);
    await expect(second).resolves.toBe(true);
  });
});
