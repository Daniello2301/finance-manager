"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { isOverdrawn } from "@/lib/balance";
import { useAccounts } from "@/hooks/useAccounts";

/**
 * An overdrawn account, said out loud on the first screen the user sees.
 *
 * The whole point of refusing an overdraft at the moment of spending is that the
 * ones which still get through — correcting a past entry, a charge the bank has
 * already made — must never sit quietly in a list the user isn't looking at.
 * Money that isn't there has already been spent, and it came from somewhere.
 *
 * A credit card inside its limit is NOT overdrawn: spending money you don't have
 * is what a card is for (see @/lib/balance).
 */
export function OverdrawnAlert() {
  // `true`: an archived account can still be overdrawn, and putting it away does
  // not settle it.
  const { data: accounts } = useAccounts(true);

  const overdrawn = accounts?.filter(isOverdrawn) ?? [];
  if (overdrawn.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangleIcon aria-hidden className="size-4" />
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {overdrawn.length === 1
            ? "Una cuenta está en descubierto:"
            : `${overdrawn.length} cuentas están en descubierto:`}
        </span>
        <ul className="flex flex-col gap-0.5">
          {overdrawn.map((account) => (
            <li key={account._id} className="flex flex-wrap gap-x-2">
              <span className="font-medium">{account.name}</span>
              <span className="font-tabular">
                {formatMoney(account.currentBalance, account.currency)}
              </span>
            </li>
          ))}
        </ul>
        <span className="text-xs">
          Ese dinero salió de algún sitio. Revisa si falta registrar un ingreso o
          un préstamo.
        </span>
        <Link
          href="/dashboard/accounts"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ver cuentas
        </Link>
      </AlertDescription>
    </Alert>
  );
}
