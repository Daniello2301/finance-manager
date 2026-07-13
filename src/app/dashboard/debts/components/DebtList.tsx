"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useDebts } from "@/hooks/useDebts";
import { DebtCard } from "./DebtCard";

export function DebtList() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: debts, isLoading, isError } = useDebts(showArchived);

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

  if (isLoading) return <ListSkeleton rows={2} />;

  if (isError) {
    return (
      <p className="text-destructive">
        No se pudieron cargar tus deudas. Intenta de nuevo.
      </p>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">
          {showArchived
            ? "No tienes deudas archivadas."
            : "No tienes deudas registradas. Si le debes dinero a alguien, regístralo aquí — basta con el nombre."}
        </p>
        {toggle}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">{toggle}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {debts.map((entry) => (
          <DebtCard key={entry.debt._id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
