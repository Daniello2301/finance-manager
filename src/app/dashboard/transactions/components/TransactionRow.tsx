"use client";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { confirmAction } from "@/lib/notifications";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useDeleteTransaction, type Transaction } from "@/hooks/useTransactions";
import { useTransactionModalStore } from "@/stores/transactionModal.store";

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { data: accounts } = useAccounts(true);
  const { data: categories } = useCategories({ includeArchived: true });
  const openEdit = useTransactionModalStore((state) => state.openEdit);
  const deleteTransaction = useDeleteTransaction();

  const accountName =
    accounts?.find((account) => account._id === transaction.accountId)?.name ??
    "Cuenta eliminada";
  const categoryName =
    categories?.find((category) => category._id === transaction.categoryId)
      ?.name ?? "Categoría eliminada";

  const isIncome = transaction.type === "income";
  const sign = isIncome ? "+" : "-";
  const amountClassName = isIncome ? "text-positive" : "text-negative";

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "¿Eliminar esta transacción?",
      text: "Esta acción no se puede deshacer.",
      confirmButtonText: "Eliminar",
    });
    if (!confirmed) return;
    deleteTransaction.mutate(transaction._id);
  };

  return (
    // Two stacked rows on a phone, one row from `sm:` up. Side by side, this
    // row cannot fit 375px: the amount is an unbreakable token (formatMoney
    // emits a non-breaking space) and the buttons carry `whitespace-nowrap
    // shrink-0`, so nothing here can give — the overflow used to spill out and
    // give the whole page a horizontal scrollbar. `min-w-0` on the details
    // column is what actually lets `truncate` engage; a flex child defaults to
    // min-width:auto and refuses to shrink below its longest word.
    <div className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{categoryName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {accountName} ·{" "}
          {new Date(transaction.date).toLocaleDateString("es-CO")}
        </span>
        {transaction.description && (
          <span className="truncate text-xs text-muted-foreground">
            {transaction.description}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <span
          className={`font-tabular text-sm font-medium ${amountClassName}`}
        >
          {sign}
          {formatMoney(transaction.amount, transaction.currency)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEdit(transaction._id)}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleteTransaction.isPending}
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
}
