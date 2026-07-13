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
import { useMonthlyTrend } from "@/hooks/useDashboard";

const RANGE_OPTIONS = [3, 6, 12] as const;

export function TrendChart() {
  const [months, setMonths] = useState<number>(6);
  const { data, isLoading, isError } = useMonthlyTrend(months);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ingresos vs. gastos</CardTitle>
        <div className="flex gap-1">
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
        {isLoading && <p className="text-muted-foreground">Cargando...</p>}
        {isError && (
          <p className="text-destructive">No se pudo cargar la tendencia.</p>
        )}
        {!isLoading && !isError && data && (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
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
