"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { useMonthlyTrend } from "@/hooks/useDashboard";

const RANGE_OPTIONS = [3, 6, 12] as const;

const MONTH_LABELS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

// The API returns period keys as "YYYY-MM". Rendered raw, each tick is ~50px
// wide against ~235px of plot area on a phone, so Recharts silently drops most
// of them and the axis becomes meaningless. "jul" fits.
function formatMonthTick(periodKey: string): string {
  const month = Number(periodKey.slice(5, 7));
  return MONTH_LABELS[month - 1] ?? periodKey;
}

// Raw COP figures ("1500000") nearly fill the Y axis's default 60px width on a
// phone. Compact notation keeps the axis narrow so the plot gets the space.
function formatAmountTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function TrendChart() {
  const [months, setMonths] = useState<number>(6);
  const { data, isLoading, isError } = useMonthlyTrend(months);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Ingresos vs. gastos</CardTitle>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              variant={months === option ? "default" : "outline"}
              size="xs"
              onClick={() => setMonths(option)}
            >
              {option}m
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <ChartSkeleton />}
        {isError && (
          <p className="text-destructive">No se pudo cargar la tendencia.</p>
        )}
        {!isLoading && !isError && data && (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={formatMonthTick} />
              <YAxis width={48} tickFormatter={formatAmountTick} />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatMoney(value, "COP") : value
                }
              />
              <Legend />
              <Bar dataKey="income" name="Ingresos" fill="var(--color-positive)" />
              <Bar dataKey="expense" name="Gastos" fill="var(--color-negative)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
