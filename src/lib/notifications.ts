import Swal from "sweetalert2";

interface ConfirmActionOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

/**
 * For irreversible actions only (e.g. permanently deleting a transaction,
 * unlike Cuentas/Categorías' reversible "archivar"). Not yet wired up
 * anywhere else — a deliberate first, narrow use of sweetalert2.
 */
export async function confirmAction(
  options: ConfirmActionOptions
): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText ?? "Sí, continuar",
    cancelButtonText: options.cancelButtonText ?? "Cancelar",
  });
  return result.isConfirmed;
}

export function notifySuccess(message: string): void {
  void Swal.fire({
    icon: "success",
    title: message,
    timer: 2000,
    showConfirmButton: false,
  });
}

export function notifyError(message: string): void {
  void Swal.fire({ icon: "error", title: message });
}
