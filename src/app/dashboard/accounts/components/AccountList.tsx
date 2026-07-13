"use client";

import { useAccounts } from "@/hooks/useAccounts";
import { AccountCard } from "./AccountCard";

export function AccountList() {
  const { data: accounts, isLoading, isError } = useAccounts();

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando cuentas...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive">
        No se pudieron cargar tus cuentas. Intenta de nuevo.
      </p>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <p className="text-muted-foreground">
        Todavía no tienes cuentas. Crea la primera para empezar a registrar
        tus movimientos.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard key={account._id} account={account} />
      ))}
    </div>
  );
}
