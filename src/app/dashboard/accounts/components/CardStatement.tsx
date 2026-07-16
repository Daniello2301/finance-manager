"use client";

import { Button } from "@/components/ui/button";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { useStatement, type Account } from "@/hooks/useAccounts";
import { useTransferModalStore } from "@/stores/transferModal.store";

const LONG_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function formatDay(isoDate: string): string {
  return LONG_DATE.format(new Date(`${isoDate}T00:00:00.000Z`));
}

/**
 * The two numbers a credit card has, kept apart and both labelled.
 *
 * The BALANCE is what you owe the bank — a 2.400.000 purchase split into 12 is
 * in there in full, because your credit limit really did drop by all of it the
 * day you bought it. The AMOUNT DUE is what this statement demands: one
 * instalment. Both are true; showing either one as the other is the central
 * error this module exists to avoid, so neither appears without its label.
 */
export function CardStatement({ account }: { account: Account }) {
  const openTransfer = useTransferModalStore((state) => state.open);
  const { data: statement, isLoading } = useStatement(account);

  if (account.type !== "credit_card") return null;

  // No dates, no cycle — and the app says so instead of estimating one. A
  // payment deadline guessed wrong is worse than no deadline at all.
  if (account.statementDay === undefined || account.paymentDay === undefined) {
    return (
      <p className="text-xs text-muted-foreground">
        Añade el día de corte y el de pago para saber cuánto pagar y hasta cuándo.
      </p>
    );
  }

  if (isLoading || !statement) {
    return <p className="text-xs text-muted-foreground">Calculando el corte...</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">
        A pagar antes del{" "}
        <strong className="font-medium text-foreground">
          {formatDay(statement.due)}
        </strong>{" "}
        para no generar intereses
      </p>
      <p className="font-display font-tabular text-xl">
        {formatMoney(statement.amountDue, statement.currency)}
      </p>
      <p className="text-xs text-muted-foreground">
        Lo que compres hoy se paga el {formatDay(statement.nextDue)}.
      </p>
      {statement.amountDue > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mt-1 self-start"
          onClick={() =>
            openTransfer({
              toAccountId: account._id,
              amount: fromMinorUnits(statement.amountDue, statement.currency),
            })
          }
        >
          Pagar tarjeta
        </Button>
      )}
    </div>
  );
}
