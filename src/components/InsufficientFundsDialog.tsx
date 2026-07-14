"use client";

import { useState } from "react";
import {
  HandCoinsIcon,
  ScaleIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CategorySelect } from "@/components/CategorySelect";
import { formatMoney, fromMinorUnits, toMinorUnits } from "@/lib/money";
import { useAdjustBalance } from "@/hooks/useAccounts";
import { useCreateDebt, useDisburseDebt } from "@/hooks/useDebts";
import { useCreateTransaction } from "@/hooks/useTransactions";

export interface InsufficientFunds {
  /** The account that came up short, and by how much. */
  accountId: string;
  available: number;
  currency: string;
  /** What the user was trying to spend. */
  attempted: number;
  description?: string;
}

/** The gap: the only amount that can be *proven* came from outside. */
function shortfall(context: InsufficientFunds): number {
  return context.attempted - context.available;
}

type Step = "choose" | "loan" | "income" | "adjustment";

interface Props {
  context: InsufficientFunds | null;
  onClose: () => void;
  /** Called once the money is accounted for — the caller retries its write. */
  onResolved: () => void;
  /** Called when the user says they picked the wrong account. */
  onWrongAccount: () => void;
}

/**
 * What happens when you try to spend money you don't have.
 *
 * It used to be a single "¿registrar de todos modos?" — an escape hatch that
 * left a mute negative balance and no explanation. It is now a fork, because if
 * you paid with money you didn't have, one of exactly four things is true, and
 * the app's job is to find out which (ratified 2026-07-14).
 *
 * The order is not cosmetic. "Ajuste de saldo" is last because it is the old
 * escape hatch in a better suit: it is honest (it gets written down, with a
 * category, visible in the history) but it is also the one a user could turn
 * into a habit, and a history full of "adjustments" says nothing at all.
 */
export function InsufficientFundsDialog({
  context,
  onClose,
  onResolved,
  onWrongAccount,
}: Props) {
  return (
    <Dialog
      open={context !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent>
        {context && (
          // `key` rather than an effect that seeds state when the dialog opens.
          // A fresh mount means the useState initialisers below do that seeding,
          // which is both simpler and what React actually wants — a synchronous
          // setState inside an effect is a cascading render, and the lint rule
          // that rejects it is right.
          <Fork
            key={`${context.accountId}:${context.attempted}`}
            context={context}
            onClose={onClose}
            onResolved={onResolved}
            onWrongAccount={onWrongAccount}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fork({
  context,
  onClose,
  onResolved,
  onWrongAccount,
}: Props & { context: InsufficientFunds }) {
  const [step, setStep] = useState<Step>("choose");
  // Seeded from the shortfall, not from the whole expense: the rest of the money
  // was already in the account. Editable, because only the user knows whether the
  // lender handed over just the gap or the full amount in cash.
  const [amount, setAmount] = useState(() =>
    String(fromMinorUnits(shortfall(context), context.currency))
  );
  const [name, setName] = useState(() =>
    context.description ? `Préstamo: ${context.description}` : "Préstamo"
  );
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createDebt = useCreateDebt();
  const disburseDebt = useDisburseDebt();
  const createTransaction = useCreateTransaction();
  const adjustBalance = useAdjustBalance();

  const busy =
    createDebt.isPending ||
    disburseDebt.isPending ||
    createTransaction.isPending ||
    adjustBalance.isPending;

  const minorAmount = () => toMinorUnits(Number(amount), context.currency);

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      onResolved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar. Intenta de nuevo."
      );
    }
  };

  const submitLoan = () =>
    run(async () => {
      if (!categoryId) throw new Error("Elige una categoría de ingreso.");
      const debt = await createDebt.mutateAsync({
        name: name.trim() || "Préstamo",
        principal: minorAmount(),
        startDate: new Date(),
      });
      // Two steps on purpose: the Debt records what you owe, the disbursement
      // records the money actually landing in the account. A debt with no
      // disbursement is the normal case (every debt that predates this flow).
      await disburseDebt.mutateAsync({
        debtId: debt._id,
        input: { accountId: context.accountId, categoryId },
      });
    });

  const submitIncome = () =>
    run(async () => {
      if (!categoryId) throw new Error("Elige una categoría de ingreso.");
      await createTransaction.mutateAsync({
        accountId: context.accountId,
        categoryId,
        type: "income",
        amount: minorAmount(),
        date: new Date(),
      });
    });

  const submitAdjustment = () =>
    run(async () => {
      await adjustBalance.mutateAsync({
        id: context.accountId,
        input: { amount: minorAmount() },
      });
    });

  return (
    <>
      <DialogHeader>
          <DialogTitle>Saldo insuficiente</DialogTitle>
          <DialogDescription>
            Esta cuenta tiene{" "}
            <strong className="font-medium text-foreground">
              {formatMoney(context.available, context.currency)}
            </strong>{" "}
            y estás registrando{" "}
            <strong className="font-medium text-foreground">
              {formatMoney(context.attempted, context.currency)}
            </strong>
            . El dinero no aparece de la nada: <strong>¿de dónde salió?</strong>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "choose" && (
          <div className="flex flex-col gap-2">
            <Choice
              icon={<HandCoinsIcon />}
              title="Lo pedí prestado"
              detail={`Crea una deuda de ${formatMoney(
                shortfall(context),
                context.currency
              )} que entra a esta cuenta`}
              onClick={() => setStep("loan")}
            />
            <Choice
              icon={<WalletIcon />}
              title="Me equivoqué de cuenta"
              detail="Volver y pagarlo desde otra cuenta"
              onClick={onWrongAccount}
            />
            <Choice
              icon={<TrendingUpIcon />}
              title="Falta registrar un ingreso"
              detail="Anota el sueldo o la transferencia que aún no habías metido"
              onClick={() => {
                setAmount("");
                setStep("income");
              }}
            />
            <Choice
              icon={<ScaleIcon />}
              title="El saldo de la app está mal"
              detail="Registra el dinero que la app no conocía. Queda escrito en tu historial."
              onClick={() => setStep("adjustment")}
            />
          </div>
        )}

        {step === "loan" && (
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="loan-name">Nombre de la deuda</FieldLabel>
              <Input
                id="loan-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="loan-amount">¿Cuánto te prestaron?</FieldLabel>
              <Input
                id="loan-amount"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Propuesto: lo que te faltaba. Si te dieron más en efectivo,
                cámbialo.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="loan-category">
                ¿Cómo entra el dinero?
              </FieldLabel>
              <CategorySelect
                id="loan-category"
                type="income"
                value={categoryId}
                onChange={setCategoryId}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Podrás editar la tasa y las cuotas luego, en Deudas.
            </p>
          </div>
        )}

        {step === "income" && (
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="income-amount">
                ¿Cuánto ingresaste?
              </FieldLabel>
              <Input
                id="income-amount"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="income-category">Categoría</FieldLabel>
              <CategorySelect
                id="income-category"
                type="income"
                value={categoryId}
                onChange={setCategoryId}
              />
            </Field>
          </div>
        )}

        {step === "adjustment" && (
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="adjustment-amount">
                ¿Cuánto le falta a la app?
              </FieldLabel>
              <Input
                id="adjustment-amount"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Se registra como un ingreso en la categoría &quot;Ajuste de
              saldo&quot;, visible en tu historial. Si lo usas a menudo, quizá el
              saldo inicial de la cuenta esté mal.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={step === "choose" ? onClose : () => setStep("choose")}
            disabled={busy}
          >
            {step === "choose" ? "Cancelar" : "Atrás"}
          </Button>
          {step === "loan" && (
            <Button onClick={submitLoan} disabled={busy}>
              Crear la deuda
            </Button>
          )}
          {step === "income" && (
            <Button onClick={submitIncome} disabled={busy}>
              Registrar el ingreso
            </Button>
          )}
          {step === "adjustment" && (
            <Button onClick={submitAdjustment} disabled={busy}>
              Ajustar el saldo
            </Button>
          )}
      </DialogFooter>
    </>
  );
}

function Choice({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
