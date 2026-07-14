import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmAction,
  notifyError,
  notifySuccess,
  toastManager,
} from "@/lib/notifications";
import { useConfirmStore } from "@/stores/confirm.store";

afterEach(() => {
  useConfirmStore.setState({ pending: null, resolve: null });
  vi.restoreAllMocks();
});

describe("confirmAction", () => {
  it("raises a pending confirmation carrying the given options", () => {
    void confirmAction({ title: "¿Eliminar?", text: "No se puede deshacer." });

    expect(useConfirmStore.getState().pending).toEqual({
      title: "¿Eliminar?",
      text: "No se puede deshacer.",
    });
  });

  it("resolves true when the confirmation is settled with true", async () => {
    const result = confirmAction({ title: "¿Eliminar?" });
    useConfirmStore.getState().settle(true);
    await expect(result).resolves.toBe(true);
  });

  it("resolves false when the confirmation is settled with false", async () => {
    const result = confirmAction({ title: "¿Eliminar?" });
    useConfirmStore.getState().settle(false);
    await expect(result).resolves.toBe(false);
  });

  it("passes custom button texts through to the pending confirmation", () => {
    void confirmAction({
      title: "¿Eliminar?",
      confirmButtonText: "Eliminar",
      cancelButtonText: "No",
    });

    expect(useConfirmStore.getState().pending).toMatchObject({
      confirmButtonText: "Eliminar",
      cancelButtonText: "No",
    });
  });
});

describe("notifySuccess", () => {
  it("adds a success toast with the given message", () => {
    const add = vi.spyOn(toastManager, "add");
    notifySuccess("Guardado");

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Guardado", type: "success" })
    );
  });

  it("auto-dismisses", () => {
    const add = vi.spyOn(toastManager, "add");
    notifySuccess("Guardado");

    const [options] = add.mock.calls[0];
    expect(options.timeout).toBeGreaterThan(0);
  });
});

describe("notifyError", () => {
  it("adds an error toast with the given message", () => {
    const add = vi.spyOn(toastManager, "add");
    notifyError("Algo falló");

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Algo falló", type: "error" })
    );
  });

  // An error is the user's only account of why their action failed — losing it
  // to a timer while they looked away would be worse than no toast at all.
  it("does not auto-dismiss", () => {
    const add = vi.spyOn(toastManager, "add");
    notifyError("Algo falló");

    const [options] = add.mock.calls[0];
    expect(options.timeout).toBe(0);
  });
});
