"use client";

import { Button } from "@/components/ui/button";
import { useTransactionModalStore } from "@/stores/transactionModal.store";
import { TransactionFilters } from "./components/TransactionFilters";
import { TransactionForm } from "./components/TransactionForm";
import { TransactionList } from "./components/TransactionList";

export default function TransactionsPage() {
  const openCreate = useTransactionModalStore((state) => state.openCreate);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Transacciones</h1>
        <Button onClick={openCreate}>Nueva transacción</Button>
      </div>
      <TransactionFilters />
      <TransactionList />
      <TransactionForm />
    </div>
  );
}
