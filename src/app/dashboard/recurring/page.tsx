"use client";

import { Button } from "@/components/ui/button";
import { useRecurringModalStore } from "@/stores/recurringModal.store";
import { RecurringForm } from "./components/RecurringForm";
import { RecurringList } from "./components/RecurringList";
import { PendingConfirmations } from "./components/PendingConfirmations";

export default function RecurringPage() {
  const openCreate = useRecurringModalStore((state) => state.openCreate);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Recurrentes</h1>
        <Button onClick={openCreate}>Nuevo recurrente</Button>
      </div>
      <PendingConfirmations />
      <RecurringList />
      <RecurringForm />
    </div>
  );
}
