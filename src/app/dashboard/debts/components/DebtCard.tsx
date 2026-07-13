"use client";

import { AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDebtModalStore } from "@/stores/debtModal.store";
import {
  useArchiveDebt,
  useUnarchiveDebt,
  type DebtWithState,
} from "@/hooks/useDebts";
import { DebtPaymentList } from "./DebtPaymentList";

export function DebtCard({ entry }: { entry: DebtWithState }) {
  const { debt, state, rate } = entry;
  const openEdit = useDebtModalStore((s) => s.openEdit);
  const openPayment = useDebtModalStore((s) => s.openPayment);
  const archiveDebt = useArchiveDebt();
  const unarchiveDebt = useUnarchiveDebt();

  // The single most dangerous confusion in this module: `null` means we don't
  // know, `0` means the debt is paid off. Rendering one as the other would tell
  // the user something false about their own money.
  const knowsBalance = state.outstanding !== null;

  return (
    <Card className={cn(debt.isArchived && "opacity-60")}>
      <CardHeader>
        <CardTitle className="truncate">{debt.name}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {debt.creditor ?? "Sin acreedor"}
          {debt.isArchived && " · Archivada"}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {knowsBalance ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <p className="font-display font-tabular text-2xl">
              {formatMoney(state.outstanding!, "COP")}
            </p>
            {state.monthlyInterest !== null && (
              <p className="text-sm text-muted-foreground">
                Intereses de este mes:{" "}
                <span className="font-tabular">
                  {formatMoney(state.monthlyInterest, "COP")}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay datos suficientes para calcular el saldo ni los intereses.
            Añade el monto original y la tasa (o la cuota y el número de cuotas)
            y aparecerán.
          </p>
        )}

        {rate && (
          <p className="text-xs text-muted-foreground">
            Tasa: {(rate.rate * 100).toFixed(2)}% mensual
            {rate.estimated && (
              // A derived number is never presented as though it came from the
              // contract.
              <span className="ms-1 rounded bg-muted px-1.5 py-0.5">
                estimada
              </span>
            )}
          </p>
        )}

        {state.arrears > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>
              Llevas{" "}
              <strong className="font-tabular">
                {formatMoney(state.arrears, "COP")}
              </strong>{" "}
              en intereses que no has cubierto. Mientras tus pagos no superen los
              intereses del mes, la deuda no baja.
            </AlertDescription>
          </Alert>
        )}

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Abonado a capital</dt>
            <dd className="font-tabular">
              {knowsBalance ? formatMoney(state.totalToPrincipal, "COP") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pagado en intereses</dt>
            <dd className="font-tabular">
              {knowsBalance ? formatMoney(state.totalToInterest, "COP") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total desembolsado</dt>
            <dd className="font-tabular">
              {formatMoney(state.totalPaid, "COP")}
            </dd>
          </div>
          {debt.installmentAmount !== undefined && (
            <div>
              <dt className="text-xs text-muted-foreground">Cuota</dt>
              <dd className="font-tabular">
                {formatMoney(debt.installmentAmount, "COP")}
              </dd>
            </div>
          )}
        </dl>

        {debt.accountNumber && (
          <p className="text-xs text-muted-foreground">
            Cuenta para pagar:{" "}
            <span className="font-tabular">{debt.accountNumber}</span>
          </p>
        )}

        {state.payments.length > 0 && (
          <DebtPaymentList payments={state.payments} />
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {debt.isArchived ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => unarchiveDebt.mutate(debt._id)}
            disabled={unarchiveDebt.isPending}
          >
            Desarchivar
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => openPayment(debt._id)}>
              Registrar pago
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(debt._id)}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => archiveDebt.mutate(debt._id)}
              disabled={archiveDebt.isPending}
            >
              Archivar
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
