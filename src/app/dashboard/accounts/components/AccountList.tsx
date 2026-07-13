"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/useAccounts";
import { AccountCard } from "./AccountCard";

export function AccountList() {
  const [showArchived, setShowArchived] = useState(false);
  // The hook has always taken this flag; nothing in the UI ever passed it, so
  // an archived account was unreachable — and, until the schema fix, also
  // impossible to bring back.
  const { data: accounts, isLoading, isError } = useAccounts(showArchived);

  const toggle = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowArchived((current) => !current)}
      aria-pressed={showArchived}
    >
      {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
    </Button>
  );

  if (isLoading) {
    return <ListSkeleton rows={3} />;
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
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">
          {showArchived
            ? "No tienes cuentas archivadas."
            : "Todavía no tienes cuentas. Crea la primera para empezar a registrar tus movimientos."}
        </p>
        {toggle}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">{toggle}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard key={account._id} account={account} />
        ))}
      </div>
    </div>
  );
}
