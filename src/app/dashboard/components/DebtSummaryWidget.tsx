"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { useDebtSummary } from "@/hooks/useDebts";

export function DebtSummaryWidget() {
  const { data, isLoading, isError } = useDebtSummary();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Deudas</CardTitle>
        <Link
          href="/dashboard/debts"
          className="text-sm text-primary hover:underline"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <ListSkeleton rows={2} />}

        {isError && (
          <p className="text-destructive">
            No se pudieron cargar tus deudas.
          </p>
        )}

        {!isLoading && !isError && data && data.activeCount === 0 && (
          <p className="text-muted-foreground">No tienes deudas registradas.</p>
        )}

        {!isLoading && !isError && data && data.activeCount > 0 && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Cuotas de este mes
                </dt>
                <dd className="font-display font-tabular text-xl">
                  {formatMoney(data.monthlyDue, "COP")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Pagado este mes
                </dt>
                <dd className="font-display font-tabular text-xl">
                  {formatMoney(data.paidThisMonth, "COP")}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Total pendiente
                </dt>
                <dd className="font-tabular">
                  {formatMoney(data.totalOutstanding, "COP")}
                  {/* A total that quietly omits the debts it can't compute is a
                      total that lies. Say so. */}
                  {data.unknownCount > 0 && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      (sin contar {data.unknownCount}{" "}
                      {data.unknownCount === 1 ? "deuda" : "deudas"} sin datos
                      suficientes)
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {data.debtsInArrears > 0 && (
              <p className="flex items-center gap-2 text-sm text-negative">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {data.debtsInArrears === 1
                  ? "Una deuda tiene intereses sin cubrir."
                  : `${data.debtsInArrears} deudas tienen intereses sin cubrir.`}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
