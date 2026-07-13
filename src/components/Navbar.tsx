"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    // `flex-wrap` + `min-w-0`: at 375px the brand and the two CTAs cannot sit on
    // one line — every Button carries `whitespace-nowrap shrink-0`, so without
    // wrapping the row would push past the viewport.
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <Link
        href="/"
        className="min-w-0 truncate font-display text-lg font-semibold"
      >
        Finanzas Personales
      </Link>

      <nav className="flex min-w-0 items-center gap-3 sm:gap-4">
        {status === "loading" && <Skeleton className="h-8 w-32" />}

        {status === "authenticated" && (
          <>
            <span className="min-w-0 truncate text-sm text-foreground">
              {session.user?.name}
            </span>
            <Button
              variant="outline"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Cerrar sesión
            </Button>
          </>
        )}

        {status === "unauthenticated" && (
          <>
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost" })}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({ variant: "default" })}
            >
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
