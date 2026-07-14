"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/stores/confirm.store";

/**
 * The single rendered home of every `confirmAction()` call. Mounted once in
 * `providers.tsx` so any code — including a plain event handler with no dialog
 * of its own — can raise a confirmation.
 */
export function ConfirmDialog() {
  const pending = useConfirmStore((state) => state.pending);
  const settle = useConfirmStore((state) => state.settle);

  return (
    <AlertDialog
      open={pending !== null}
      // Escape (the only dismissal an AlertDialog allows — outside-press is
      // blocked by the primitive) counts as "no".
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          {pending?.text ? (
            <AlertDialogDescription>{pending.text}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {pending?.cancelButtonText ?? "Cancelar"}
          </Button>
          <Button variant="destructive" onClick={() => settle(true)}>
            {pending?.confirmButtonText ?? "Sí, continuar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
