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
  useUnarchiveAccount,
  type Account,
} from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<Account["type"], string> = {
  bank: "Banco",
  cash: "Efectivo",
  credit_card: "Tarjeta de crédito",
};

export function AccountCard({ account }: { account: Account }) {
  const openEdit = useAccountModalStore((state) => state.openEdit);
  const archiveAccount = useArchiveAccount();
  const unarchiveAccount = useUnarchiveAccount();
  const recomputeBalance = useRecomputeBalance();

  const availableCredit =
    account.type === "credit_card" && account.creditLimit !== undefined
      ? account.creditLimit + account.currentBalance
      : null;

  return (
    <Card className={cn(account.isArchived && "opacity-60")}>
      <CardHeader>
        <CardTitle className="truncate">{account.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {TYPE_LABELS[account.type]} · {account.currency}
          {account.isArchived && " · Archivada"}
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
      {/* An archived account only offers the way back. Editing or recomputing
          something the user has put away is noise — and it kept the card from
          being a wall of buttons. */}
      <CardFooter className="flex flex-wrap gap-2">
        {account.isArchived ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => unarchiveAccount.mutate(account._id)}
            disabled={unarchiveAccount.isPending}
          >
            Desarchivar
          </Button>
        ) : (
          <>
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
          </>
        )}
      </CardFooter>
    </Card>
  );
}
