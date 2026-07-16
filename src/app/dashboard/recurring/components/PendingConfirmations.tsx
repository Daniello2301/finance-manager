"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fromMinorUnits, toMinorUnits } from "@/lib/money";
import { isInsufficientFunds } from "@/lib/api-client";
import {
  InsufficientFundsDialog,
  type InsufficientFunds,
} from "@/components/InsufficientFundsDialog";
import { dueOccurrences, occurrenceKey } from "@/lib/recurrence";
import {
  useConfirmOccurrence,
  useRecurring,
  useSkipOccurrence,
  type Recurring,
} from "@/hooks/useRecurring";

const LONG_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

interface Pending {
  recurring: Recurring;
  occurrenceKey: string;
  date: Date;
  overdueCount: number;
}

/**
 * The manual templates that have come due — shown, never auto-created (FR-005).
 *
 * Derived in the browser from the recurring list via the same pure date engine
 * the server uses, so the occurrence keys match exactly and no extra round-trip
 * is needed. Confirming is a decision, so an overdraw raises the four-exit dialog.
 */
export function PendingConfirmations() {
  const { data: recurring } = useRecurring(false);
  const confirm = useConfirmOccurrence();
  const skip = useSkipOccurrence();

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [shortfall, setShortfall] = useState<InsufficientFunds | null>(null);
  const [retry, setRetry] = useState<Pending | null>(null);

  const today = new Date();
  const pending: Pending[] = (recurring ?? [])
    .filter((r) => !r.autoGenerate && !r.isPaused && !r.isArchived)
    .map((r) => {
      const dues = dueOccurrences(
        {
          nextDueDate: new Date(r.nextDueDate),
          frequency: r.frequency,
          anchorDay: r.anchorDay,
          endDate: r.endDate ? new Date(r.endDate) : null,
        },
        today
      );
      if (dues.length === 0) return null;
      return {
        recurring: r,
        occurrenceKey: occurrenceKey(dues[0]),
        date: dues[0],
        overdueCount: dues.length,
      };
    })
    .filter((p): p is Pending => p !== null);

  if (pending.length === 0) return null;

  const submit = async (item: Pending) => {
    const raw = amounts[item.recurring._id];
    const major =
      raw !== undefined && raw.trim() !== ""
        ? Number(raw)
        : fromMinorUnits(item.recurring.amount, "COP");
    const amount = toMinorUnits(major, "COP");

    try {
      await confirm.mutateAsync({
        id: item.recurring._id,
        occurrenceKey: item.occurrenceKey,
        amount,
      });
    } catch (error) {
      if (isInsufficientFunds(error)) {
        setRetry(item);
        setShortfall({
          accountId: item.recurring.accountId,
          available: error.body.available,
          currency: error.body.currency,
          attempted: amount,
          description: item.recurring.name,
        });
      }
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg font-medium">Por confirmar</h2>
        <p className="text-xs text-muted-foreground">
          Estos ya vencieron. Confírmalos (puedes corregir el monto) o sáltalos.
        </p>
        <div className="flex flex-col gap-3">
          {pending.map((item) => (
            <div
              key={item.recurring._id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.recurring.name}</p>
                <p className="text-xs text-muted-foreground">
                  Venció el {LONG_DATE.format(item.date)}
                  {item.overdueCount > 1
                    ? ` · ${item.overdueCount} pendientes`
                    : ""}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Monto
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="w-32"
                    value={
                      amounts[item.recurring._id] ??
                      String(fromMinorUnits(item.recurring.amount, "COP"))
                    }
                    onChange={(event) =>
                      setAmounts((prev) => ({
                        ...prev,
                        [item.recurring._id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <Button
                  size="sm"
                  onClick={() => submit(item)}
                  disabled={confirm.isPending}
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    skip.mutate({
                      id: item.recurring._id,
                      occurrenceKey: item.occurrenceKey,
                    })
                  }
                  disabled={skip.isPending}
                >
                  Saltar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <InsufficientFundsDialog
        context={shortfall}
        onClose={() => {
          setShortfall(null);
          setRetry(null);
        }}
        onResolved={() => {
          setShortfall(null);
          if (retry) void submit(retry);
          setRetry(null);
        }}
        onWrongAccount={() => {
          setShortfall(null);
          setRetry(null);
        }}
      />
    </Card>
  );
}
