"use client";

import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { useBudgets, useDeleteBudget, type Budget } from "@/hooks/useBudgets";
import { confirmAction } from "@/lib/notifications";
import { useBudgetModalStore } from "@/stores/budgetModal.store";
import { BudgetProgress } from "@/components/BudgetProgress";

function BudgetRow({
  budget,
  categoryName,
}: {
  budget: Budget;
  categoryName: string;
}) {
  const openEdit = useBudgetModalStore((state) => state.openEdit);
  const deleteBudget = useDeleteBudget();

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "¿Eliminar este presupuesto?",
      text: "Esta acción no se puede deshacer.",
      confirmButtonText: "Eliminar",
    });
    if (!confirmed) return;
    deleteBudget.mutate(budget._id);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{categoryName}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEdit(budget._id)}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteBudget.isPending}
          >
            Eliminar
          </Button>
        </div>
      </div>
      <BudgetProgress
        spentAmount={budget.spentAmount}
        limitAmount={budget.limitAmount}
        currency={budget.currency}
        percentUsed={budget.percentUsed}
      />
    </div>
  );
}

export function BudgetList({ period }: { period: string }) {
  const { data: budgets, isLoading, isError } = useBudgets(period);
  const { data: categories } = useCategories({ includeArchived: true });

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando presupuestos...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive">
        No se pudieron cargar tus presupuestos. Intenta de nuevo.
      </p>
    );
  }

  if (!budgets || budgets.length === 0) {
    return (
      <p className="text-muted-foreground">
        No tienes presupuestos definidos para este mes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {budgets.map((budget) => {
        const categoryName =
          categories?.find((category) => category._id === budget.categoryId)
            ?.name ?? "Categoría eliminada";
        return (
          <BudgetRow
            key={budget._id}
            budget={budget}
            categoryName={categoryName}
          />
        );
      })}
    </div>
  );
}
