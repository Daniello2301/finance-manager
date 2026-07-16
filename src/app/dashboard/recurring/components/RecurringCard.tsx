"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { confirmAction } from "@/lib/notifications";
import {
  useArchiveRecurring,
  usePauseRecurring,
  useUnarchiveRecurring,
  type Recurring,
} from "@/hooks/useRecurring";
import { useRecurringModalStore } from "@/stores/recurringModal.store";

const FREQUENCY_LABEL: Record<Recurring["frequency"], string> = {
  weekly: "Semanal",
  biweekly: "Cada 2 semanas",
  monthly: "Mensual",
  yearly: "Anual",
};

const LONG_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDue(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

export function RecurringCard({ recurring }: { recurring: Recurring }) {
  const openEdit = useRecurringModalStore((state) => state.openEdit);
  const pause = usePauseRecurring();
  const archive = useArchiveRecurring();
  const unarchive = useUnarchiveRecurring();

  const isIncome = recurring.type === "income";

  const onArchive = async () => {
    const ok = await confirmAction({
      title: "¿Archivar este recurrente?",
      text: "Dejará de vencer. Las transacciones que ya generó se conservan en tu historial.",
      confirmButtonText: "Archivar",
    });
    if (ok) archive.mutate(recurring._id);
  };

  return (
    <Card className={recurring.isPaused ? "opacity-70" : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-medium">
              {recurring.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {FREQUENCY_LABEL[recurring.frequency]} ·{" "}
              {recurring.autoGenerate ? "Se cobra solo" : "Lo pagas tú"}
            </p>
          </div>
          <p
            className={`shrink-0 font-display font-tabular text-lg ${
              isIncome ? "text-[var(--positive)]" : "text-foreground"
            }`}
          >
            {isIncome ? "+" : ""}
            {formatMoney(recurring.amount, "COP")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {recurring.isArchived ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              Archivado
            </span>
          ) : recurring.isPaused ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              En pausa
            </span>
          ) : (
            <span className="text-muted-foreground">
              Próximo: {formatDue(recurring.nextDueDate)}
            </span>
          )}
        </div>

        {!recurring.isArchived && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openEdit(recurring._id)}>
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                pause.mutate({ id: recurring._id, isPaused: !recurring.isPaused })
              }
              disabled={pause.isPending}
            >
              {recurring.isPaused ? "Reanudar" : "Pausar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onArchive}>
              Archivar
            </Button>
          </div>
        )}

        {recurring.isArchived && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unarchive.mutate(recurring._id)}
              disabled={unarchive.isPending}
            >
              Desarchivar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
