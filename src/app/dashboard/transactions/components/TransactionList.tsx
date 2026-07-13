"use client";

import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransactionFiltersStore } from "@/stores/transactionFilters.store";
import { TransactionRow } from "./TransactionRow";

export function TransactionList() {
  const accountId = useTransactionFiltersStore((state) => state.accountId);
  const categoryId = useTransactionFiltersStore((state) => state.categoryId);
  const type = useTransactionFiltersStore((state) => state.type);
  const dateFrom = useTransactionFiltersStore((state) => state.dateFrom);
  const dateTo = useTransactionFiltersStore((state) => state.dateTo);
  const page = useTransactionFiltersStore((state) => state.page);
  const setPage = useTransactionFiltersStore((state) => state.setPage);

  const { data, isLoading, isError } = useTransactions({
    accountId,
    categoryId,
    type,
    dateFrom,
    dateTo,
    page,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando transacciones...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive">
        No se pudieron cargar tus transacciones. Intenta de nuevo.
      </p>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <p className="text-muted-foreground">
        No hay transacciones que coincidan con estos filtros.
      </p>
    );
  }

  const { pagination } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        {data.data.map((transaction) => (
          <TransactionRow key={transaction._id} transaction={transaction} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {pagination.page} de {pagination.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
