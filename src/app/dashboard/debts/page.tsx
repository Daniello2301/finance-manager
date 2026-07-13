"use client";

import { Button } from "@/components/ui/button";
import { useDebtModalStore } from "@/stores/debtModal.store";
import { DebtForm } from "./components/DebtForm";
import { DebtList } from "./components/DebtList";
import { DebtPaymentForm } from "./components/DebtPaymentForm";

export default function DebtsPage() {
  const openCreate = useDebtModalStore((state) => state.openCreate);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Deudas</h1>
        <Button onClick={openCreate}>Nueva deuda</Button>
      </div>
      <DebtList />
      <DebtForm />
      <DebtPaymentForm />
    </div>
  );
}
