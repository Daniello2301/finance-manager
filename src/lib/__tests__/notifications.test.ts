import { describe, expect, it, vi } from "vitest";
import Swal from "sweetalert2";
import { confirmAction, notifyError, notifySuccess } from "@/lib/notifications";

vi.mock("sweetalert2", () => ({
  default: { fire: vi.fn() },
}));

describe("confirmAction", () => {
  it("resolves true when the user confirms", async () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    } as never);

    const result = await confirmAction({ title: "¿Eliminar?" });
    expect(result).toBe(true);
  });

  it("resolves false when the user cancels", async () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({
      isConfirmed: false,
      isDenied: false,
      isDismissed: true,
    } as never);

    const result = await confirmAction({ title: "¿Eliminar?" });
    expect(result).toBe(false);
  });

  it("uses default button texts when not provided", async () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    } as never);

    await confirmAction({ title: "¿Eliminar?" });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmButtonText: "Sí, continuar",
        cancelButtonText: "Cancelar",
      })
    );
  });

  it("uses custom button texts when provided", async () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    } as never);

    await confirmAction({
      title: "¿Eliminar?",
      confirmButtonText: "Eliminar",
      cancelButtonText: "No",
    });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmButtonText: "Eliminar",
        cancelButtonText: "No",
      })
    );
  });
});

describe("notifySuccess", () => {
  it("fires a success alert with the given message", () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({} as never);
    notifySuccess("Guardado");
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "success", title: "Guardado" })
    );
  });
});

describe("notifyError", () => {
  it("fires an error alert with the given message", () => {
    vi.mocked(Swal.fire).mockResolvedValueOnce({} as never);
    notifyError("Algo falló");
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "error", title: "Algo falló" })
    );
  });
});
