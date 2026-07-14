"use client";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { CheckCircle2Icon, XIcon, AlertCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Renders every toast currently held by the manager. Mount once, inside a
 * `<ToastPrimitive.Provider>` (see `src/app/providers.tsx`).
 *
 * Toasts are pushed imperatively through `notifySuccess`/`notifyError` in
 * `@/lib/notifications`, which write to the module-level toast manager rather
 * than going through a React hook — that's what lets non-component code (a
 * React Query `onError`, a plain event handler) raise one.
 */
function Toaster() {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        // `bottom` uses the safe-area inset so a toast never lands under the
        // mobile browser's bottom bar (the root layout sets viewportFit:"cover",
        // without which env(safe-area-inset-*) is always 0).
        className="fixed right-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 z-100 mx-auto flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-4 sm:left-auto sm:mx-0"
      >
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              "transition-all duration-200 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
            )}
          >
            {toast.type === "error" ? (
              <AlertCircleIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-negative"
              />
            ) : (
              <CheckCircle2Icon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-positive"
              />
            )}
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="font-medium break-words" />
              <ToastPrimitive.Description className="mt-0.5 break-words text-muted-foreground empty:hidden" />
            </div>
            <ToastPrimitive.Close
              render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
            >
              <XIcon />
              <span className="sr-only">Cerrar</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

export { Toaster, ToastPrimitive };
