"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useRecurring } from "@/hooks/useRecurring";
import { RecurringCard } from "./RecurringCard";

export function RecurringList() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: recurring, isLoading, isError } = useRecurring(showArchived);

  const toggle = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowArchived((current) => !current)}
      aria-pressed={showArchived}
    >
      {showArchived ? "Ocultar archivados" : "Ver archivados"}
    </Button>
  );

  if (isLoading) return <ListSkeleton rows={2} />;

  if (isError) {
    return (
      <p className="text-destructive">
        No se pudieron cargar tus recurrentes. Intenta de nuevo.
      </p>
    );
  }

  if (!recurring || recurring.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">
          {showArchived
            ? "No tienes recurrentes archivados."
            : "No tienes recurrentes. Declara tus gastos fijos y tu sueldo para que la app registre lo que se cobra solo y te recuerde lo que pagas tú."}
        </p>
        {toggle}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">{toggle}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {recurring.map((entry) => (
          <RecurringCard key={entry._id} recurring={entry} />
        ))}
      </div>
    </div>
  );
}
