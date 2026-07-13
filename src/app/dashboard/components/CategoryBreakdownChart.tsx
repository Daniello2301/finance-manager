"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { useCategoryBreakdown } from "@/hooks/useDashboard";

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const SLICE_COLORS = [
  "var(--color-primary)",
  "var(--color-negative)",
  "var(--color-positive)",
  "var(--color-accent-foreground)",
  "var(--color-secondary-foreground)",
  "var(--color-muted-foreground)",
];

export function CategoryBreakdownChart() {
  const { data, isLoading, isError } = useCategoryBreakdown(
    currentPeriodKey()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por categoría (mes actual)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground">Cargando...</p>}
        {isError && (
          <p className="text-destructive">
            No se pudo cargar la distribución.
          </p>
        )}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <p className="text-muted-foreground">
            Aún no registras gastos este mes.
          </p>
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) =>
                  `${name} ${Math.round((percent ?? 0) * 100)}%`
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.categoryId}
                    fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatMoney(value, "COP") : value
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
