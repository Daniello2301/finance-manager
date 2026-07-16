"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccountSelect } from "@/components/AccountSelect";
import {
  InsufficientFundsDialog,
  type InsufficientFunds,
} from "@/components/InsufficientFundsDialog";
import { isInsufficientFunds } from "@/lib/api-client";
import { toMinorUnits } from "@/lib/money";
import { notifySuccess } from "@/lib/notifications";
import { useTransfer } from "@/hooks/useTransfers";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Prefilled when opened from a card's "Pagar tarjeta" button. */
  defaultToAccountId?: string;
  defaultAmount?: number;
}

/**
 * Moving money between two of the user's own accounts.
 *
 * This is not spending and it is not earning — it's the same money, somewhere
 * else — so it never shows up in a month's income or expense (see
 * `services/transfers.ts`). It is also the only way to pay a credit card: before
 * this existed, a card's balance could only ever get more negative.
 */
export function TransferForm({
  open,
  onClose,
  defaultToAccountId,
  defaultAmount,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {open && (
          // Remount per opening: the useState initialisers below do the seeding,
          // instead of an effect (a synchronous setState in an effect is a
          // cascading render, and the lint rule that rejects it is right).
          <TransferFields
            key={`${defaultToAccountId ?? ""}:${defaultAmount ?? ""}`}
            onClose={onClose}
            defaultToAccountId={defaultToAccountId}
            defaultAmount={defaultAmount}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferFields({
  onClose,
  defaultToAccountId,
  defaultAmount,
}: Omit<Props, "open">) {
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState(defaultToAccountId ?? "");
  const [amount, setAmount] = useState(
    defaultAmount ? String(defaultAmount) : ""
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<InsufficientFunds | null>(null);

  const transfer = useTransfer();

  const submit = async () => {
    setError(null);
    const minor = toMinorUnits(Number(amount), "COP");

    if (!fromAccountId || !toAccountId) {
      setError("Elige la cuenta de origen y la de destino.");
      return;
    }
    if (fromAccountId === toAccountId) {
      setError("No puedes transferir a la misma cuenta.");
      return;
    }
    if (!Number.isFinite(minor) || minor <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }

    try {
      await transfer.mutateAsync({
        fromAccountId,
        toAccountId,
        amount: minor,
        description: description.trim() || undefined,
      });
      notifySuccess("Transferencia registrada.");
      onClose();
    } catch (err) {
      // Moving money you don't have is a decision like any other, so it gets the
      // same fork: the app asks where the money came from.
      if (isInsufficientFunds(err)) {
        setShortfall({
          accountId: fromAccountId,
          available: err.body.available,
          currency: err.body.currency,
          attempted: minor,
          description: description.trim() || undefined,
        });
        return;
      }
      setError(
        err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo."
      );
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Transferir entre cuentas</DialogTitle>
        <DialogDescription>
          El mismo dinero, en otro sitio. No cuenta como ingreso ni como gasto.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="transfer-from">Desde</FieldLabel>
          <AccountSelect
            id="transfer-from"
            value={fromAccountId}
            onChange={setFromAccountId}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="transfer-to">Hacia</FieldLabel>
          <AccountSelect
            id="transfer-to"
            value={toAccountId}
            onChange={setToAccountId}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="transfer-amount">Monto</FieldLabel>
          <Input
            id="transfer-amount"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="transfer-description">
            Descripción (opcional)
          </FieldLabel>
          <Input
            id="transfer-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={transfer.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={transfer.isPending}>
          {transfer.isPending ? "Transfiriendo..." : "Transferir"}
        </Button>
      </div>

      <InsufficientFundsDialog
        context={shortfall}
        onClose={() => setShortfall(null)}
        onResolved={() => {
          setShortfall(null);
          void submit();
        }}
        onWrongAccount={() => setShortfall(null)}
      />
    </>
  );
}
