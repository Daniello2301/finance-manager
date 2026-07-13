"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgress } from "@/components/BudgetProgress";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/hooks/useCategories";
import { useDashboardSummary } from "@/hooks/useDashboard";

export function BudgetSummaryWidget() {
  const { data, isLoading, isError } = useDashboardSummary();
  const { data: categories, isLoading: categoriesLoading } = useCategories({
    includeArchived: true,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Presupuestos del mes</CardTitle>
        <Link
          href="/dashboard/budgets"
          className="text-sm text-primary hover:underline"
        >
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && <ListSkeleton rows={3} />}
        {isError && (
          <p className="text-destructive">
            No se pudieron cargar los presupuestos.
          </p>
        )}
        {!isLoading &&
          !isError &&
          (!data?.topBudgets || data.topBudgets.length === 0) && (
            <p className="text-muted-foreground">
              No tienes presupuestos definidos este mes.
            </p>
          )}
        {data?.topBudgets.map((budget) => {
          // While categories are still loading, `.find()` would otherwise
          // resolve to undefined and falsely label a valid category as
          // deleted for a moment — show a neutral placeholder instead.
          const categoryName = categoriesLoading
            ? "…"
            : (categories?.find(
                (category) => category._id === budget.categoryId
              )?.name ?? "Categoría eliminada");
          return (
            <div key={budget._id} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{categoryName}</span>
              <BudgetProgress
                spentAmount={budget.spentAmount}
                limitAmount={budget.limitAmount}
                currency={budget.currency}
                percentUsed={budget.percentUsed}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
