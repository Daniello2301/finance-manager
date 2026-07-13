"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <Link href="/" className="font-display text-lg font-semibold">
        Finanzas Personales
      </Link>

      <nav className="flex items-center gap-4">
        {status === "loading" && (
          <span className="text-sm text-muted-foreground">Cargando...</span>
        )}

        {status === "authenticated" && (
          <>
            <span className="text-sm text-foreground">
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
              className="text-sm font-medium text-foreground hover:text-primary"
            >
              Iniciar sesión
            </Link>
            <Link href="/signup" className={buttonVariants({ variant: "default" })}>
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
