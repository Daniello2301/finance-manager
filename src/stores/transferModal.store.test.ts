import { afterEach, describe, expect, it } from "vitest";
import { useTransferModalStore } from "@/stores/transferModal.store";

describe("useTransferModalStore", () => {
  afterEach(() => {
    useTransferModalStore.setState({
      isOpen: false,
      toAccountId: undefined,
      amount: undefined,
    });
  });

  it("starts closed with no prefill", () => {
    const state = useTransferModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.toAccountId).toBeUndefined();
    expect(state.amount).toBeUndefined();
  });

  it("open with no argument just opens the modal", () => {
    useTransferModalStore.getState().open();
    const state = useTransferModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.toAccountId).toBeUndefined();
    expect(state.amount).toBeUndefined();
  });

  it("open with a prefill seeds the destination account and amount", () => {
    useTransferModalStore.getState().open({ toAccountId: "card-1", amount: 500_000 });
    const state = useTransferModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.toAccountId).toBe("card-1");
    expect(state.amount).toBe(500_000);
  });

  it("close resets the open flag and clears the prefill", () => {
    useTransferModalStore.getState().open({ toAccountId: "card-1", amount: 500_000 });
    useTransferModalStore.getState().close();
    const state = useTransferModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.toAccountId).toBeUndefined();
    expect(state.amount).toBeUndefined();
  });
});
