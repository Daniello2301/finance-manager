"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useRecentTransactions } from "@/hooks/useDashboard";

export function RecentTransactionsWidget() {
  const { data: transactions, isLoading, isError } = useRecentTransactions(5);
  const { data: accounts, isLoading: accountsLoading } = useAccounts(true);
  const { data: categories, isLoading: categoriesLoading } = useCategories({
    includeArchived: true,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Transacciones recientes</CardTitle>
        <Link
          href="/dashboard/transactions"
          className="text-sm text-primary hover:underline"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col">
        {isLoading && <ListSkeleton rows={5} />}
        {isError && (
          <p className="text-destructive">
            No se pudieron cargar las transacciones.
          </p>
        )}
        {!isLoading && !isError && (!transactions || transactions.length === 0) && (
          <p className="text-muted-foreground">
            Aún no registras transacciones.
          </p>
        )}
        {transactions?.map((transaction) => {
          // While categories/accounts are still loading, `.find()` would
          // otherwise resolve to undefined and falsely label valid
          // categories/accounts as deleted for a moment.
          const categoryName = categoriesLoading
            ? "…"
            : (categories?.find(
                (category) => category._id === transaction.categoryId
              )?.name ?? "Categoría eliminada");
          const accountName = accountsLoading
            ? "…"
            : (accounts?.find(
                (account) => account._id === transaction.accountId
              )?.name ?? "Cuenta eliminada");
          const isIncome = transaction.type === "income";

          return (
            <div
              key={transaction._id}
              className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {categoryName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {accountName} ·{" "}
                  {new Date(transaction.date).toLocaleDateString("es-CO")}
                </span>
              </div>
              <span
                className={`shrink-0 font-tabular text-sm font-medium ${
                  isIncome ? "text-positive" : "text-negative"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatMoney(transaction.amount, transaction.currency)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
