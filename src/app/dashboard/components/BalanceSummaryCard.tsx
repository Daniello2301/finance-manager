"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { useDashboardSummary } from "@/hooks/useDashboard";

export function BalanceSummaryCard() {
  const { data, isLoading, isError } = useDashboardSummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance total</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading && <p className="text-muted-foreground">Cargando...</p>}
        {isError && (
          <p className="text-destructive">No se pudo cargar el balance.</p>
        )}
        {!isLoading &&
          !isError &&
          (!data?.balances || data.balances.length === 0) && (
            <p className="text-muted-foreground">
              Aún no tienes cuentas activas.
            </p>
          )}
        {data?.balances.map((balance) => (
          <p
            key={balance.currency}
            className="font-display font-tabular text-2xl"
          >
            {formatMoney(balance.total, balance.currency)}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
