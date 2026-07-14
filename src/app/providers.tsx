"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { Toaster, ToastPrimitive } from "@/components/ui/toast";
import { toastManager } from "@/lib/notifications";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {/* `toastManager` is the module-level manager `notifySuccess`/
            `notifyError` push to, so toasts can be raised from outside React. */}
        <ToastPrimitive.Provider toastManager={toastManager}>
          {children}
          <Toaster />
          <ConfirmDialog />
          <ServiceWorkerRegistrar />
        </ToastPrimitive.Provider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
