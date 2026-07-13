"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { getCurrentPeriodKey } from "@/lib/period";
import { useCategoryBreakdown } from "@/hooks/useDashboard";

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
    getCurrentPeriodKey()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por categoría (mes actual)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <ChartSkeleton />}
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
              {/* No `label` render-prop: Recharts draws those on leader lines
                  *outside* outerRadius, so a name like "Entretenimiento 32%"
                  ran past the SVG viewBox and got sliced mid-word on a phone.
                  The Legend already names every slice and the Tooltip gives the
                  exact figure, so the labels were redundant as well as broken.
                  outerRadius as a percentage lets the pie shrink with the card
                  instead of staying a fixed 180px. */}
              <Pie
                data={data}
                dataKey="total"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                outerRadius="70%"
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
