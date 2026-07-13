"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonthSelector, shiftPeriod } from "@/components/MonthSelector";
import { getCurrentPeriodKey } from "@/lib/period";
import { useBudgetModalStore } from "@/stores/budgetModal.store";
import { useCopyBudgets } from "@/hooks/useBudgets";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { BudgetForm } from "./components/BudgetForm";
import { BudgetList } from "./components/BudgetList";

export default function BudgetsPage() {
  const [period, setPeriod] = useState(getCurrentPeriodKey);
  const openCreate = useBudgetModalStore((state) => state.openCreate);
  const copyBudgets = useCopyBudgets();

  const handleCopy = async () => {
    try {
      const created = await copyBudgets.mutateAsync({
        fromPeriod: shiftPeriod(period, -1),
        toPeriod: period,
      });
      notifySuccess(
        created.length > 0
          ? `Se copiaron ${created.length} presupuesto(s) del mes anterior.`
          : "No había presupuestos nuevos para copiar."
      );
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : "No se pudieron copiar los presupuestos."
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Presupuestos</h1>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector value={period} onChange={setPeriod} />
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={copyBudgets.isPending}
          >
            Copiar del mes anterior
          </Button>
          <Button onClick={openCreate}>Nuevo presupuesto</Button>
        </div>
      </div>
      <BudgetList period={period} />
      <BudgetForm period={period} />
    </div>
  );
}
