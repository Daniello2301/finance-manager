"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
        {isLoading && <Skeleton className="h-8 w-40" />}
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
