"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { useAccountModalStore } from "@/stores/accountModal.store";
import {
  useArchiveAccount,
  useRecomputeBalance,
  type Account,
} from "@/hooks/useAccounts";

const TYPE_LABELS: Record<Account["type"], string> = {
  bank: "Banco",
  cash: "Efectivo",
  credit_card: "Tarjeta de crédito",
};

export function AccountCard({ account }: { account: Account }) {
  const openEdit = useAccountModalStore((state) => state.openEdit);
  const archiveAccount = useArchiveAccount();
  const recomputeBalance = useRecomputeBalance();

  const availableCredit =
    account.type === "credit_card" && account.creditLimit !== undefined
      ? account.creditLimit + account.currentBalance
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{account.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {TYPE_LABELS[account.type]} · {account.currency}
        </p>
        <p className="font-display font-tabular text-2xl">
          {formatMoney(account.currentBalance, account.currency)}
        </p>
        {availableCredit !== null && (
          <p className="text-sm text-muted-foreground">
            Disponible: {formatMoney(availableCredit, account.currency)}
          </p>
        )}
      </CardContent>
      {/* `flex-wrap`: three unshrinkable buttons ("Recalcular saldo" is wide)
          barely fit a card at 375px, and Card is `overflow-hidden`, so the
          third one was one font-size bump away from being silently clipped
          rather than wrapping. */}
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEdit(account._id)}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => archiveAccount.mutate(account._id)}
          disabled={archiveAccount.isPending}
        >
          Archivar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => recomputeBalance.mutate(account._id)}
          disabled={recomputeBalance.isPending}
        >
          Recalcular saldo
        </Button>
      </CardFooter>
    </Card>
  );
}
