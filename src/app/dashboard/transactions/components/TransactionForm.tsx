"use client";

import { useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccountSelect } from "@/components/AccountSelect";
import { CategorySelect } from "@/components/CategorySelect";
import { fromMinorUnits, toMinorUnits } from "@/lib/money";
import { isInsufficientFunds } from "@/lib/api-client";
import {
  InsufficientFundsDialog,
  type InsufficientFunds,
} from "@/components/InsufficientFundsDialog";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "@/lib/validation/transactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useSeedForm } from "@/hooks/useSeedForm";
import { useTransactionModalStore } from "@/stores/transactionModal.store";
import {
  useCreateTransaction,
  useTransaction,
  useUpdateTransaction,
} from "@/hooks/useTransactions";

interface TransactionFormValues {
  accountId: string;
  categoryId: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description?: string;
  /** A deferred card purchase. 1 (or blank) means "not deferred". */
  installmentCount?: number;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm() {
  const isOpen = useTransactionModalStore((state) => state.isOpen);
  const editingTransactionId = useTransactionModalStore(
    (state) => state.editingTransactionId
  );
  const close = useTransactionModalStore((state) => state.close);

  const isEditing = Boolean(editingTransactionId);
  const { data: editingTransaction } = useTransaction(editingTransactionId);

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const isSubmitting =
    createTransaction.isPending || updateTransaction.isPending;

  // Set when the server refuses the write for lack of funds. Holds the figures
  // the server sent back, which are the authoritative ones — the cached balance
  // in this component can be stale.
  const [shortfall, setShortfall] = useState<InsufficientFunds | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    // createTransactionSchema/updateTransactionSchema infer a shape whose
    // `date` field is a coerced Date, not this form's raw "YYYY-MM-DD"
    // string — same cast pattern as AccountForm.tsx/CategoryForm.tsx, routed
    // through `unknown` since the `date` types don't overlap enough for a
    // direct cast.
    resolver: zodResolver(
      isEditing ? updateTransactionSchema : createTransactionSchema
    ) as unknown as Resolver<TransactionFormValues>,
  });

  const selectedType = watch("type");
  const selectedAccountId = watch("accountId");

  const { data: accounts } = useAccounts();
  const selectedAccount = accounts?.find((a) => a._id === selectedAccountId);
  // Deferring only means anything on a credit card, and only for spending.
  const canDefer =
    selectedAccount?.type === "credit_card" && selectedType === "expense";

  useSeedForm({
    isOpen,
    target: editingTransactionId ?? "create",
    ready: !isEditing || Boolean(editingTransaction),
    seed: () => {
      if (isEditing && editingTransaction) {
        reset({
          accountId: editingTransaction.accountId,
          categoryId: editingTransaction.categoryId,
          type: editingTransaction.type,
          amount: fromMinorUnits(
            editingTransaction.amount,
            editingTransaction.currency
          ),
          date: editingTransaction.date.slice(0, 10),
          description: editingTransaction.description ?? "",
        });
      } else {
        reset({
          accountId: "",
          categoryId: "",
          type: "expense",
          amount: 0,
          date: todayIsoDate(),
          description: "",
        });
      }
    },
  });

  const selectType = (type: "income" | "expense") => {
    setValue("type", type, { shouldValidate: true });
    // Cleared here, not in a useEffect keyed on `selectedType` — an effect
    // would also fire during the initial reset() when editing, wiping out
    // the category that was just preloaded.
    setValue("categoryId", "");
  };

  const submitValues = async (values: TransactionFormValues) => {
    const input = {
      accountId: values.accountId,
      categoryId: values.categoryId,
      type: values.type,
      amount: toMinorUnits(values.amount, "COP"),
      date: new Date(values.date),
      description: values.description || undefined,
      // The card is still debited IN FULL — your credit limit really does drop
      // by the whole purchase the day you buy it. This only changes what each
      // statement demands. It creates no Debt: that would count it twice.
      installmentCount:
        canDefer && values.installmentCount && values.installmentCount >= 2
          ? Number(values.installmentCount)
          : undefined,
    };

    try {
      if (isEditing && editingTransactionId) {
        await updateTransaction.mutateAsync({
          id: editingTransactionId,
          input,
        });
      } else {
        await createTransaction.mutateAsync(input);
      }
      close();
    } catch (error) {
      // The server is the authority on the balance — the cached one here can be
      // stale — so we don't pre-check: we let the write be rejected and quote
      // the figure the server sent back. There is no "register it anyway" any
      // more (ratified 2026-07-14): the money came from somewhere, and the
      // dialog's whole job is to find out where.
      if (isInsufficientFunds(error)) {
        setShortfall({
          accountId: values.accountId,
          available: error.body.available,
          currency: error.body.currency,
          attempted: input.amount,
          description: input.description,
        });
        return;
      }

      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error. Intenta de nuevo.",
      });
    }
  };

  const onSubmit = (values: TransactionFormValues) => submitValues(values);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Never close while the insufficient-funds fork raised from inside this
        // form is still open — closing would throw away what the user typed,
        // just as they answer a question the form itself asked.
        if (!open && !shortfall) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar transacción" : "Nueva transacción"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedType === "expense" ? "default" : "outline"}
                  onClick={() => selectType("expense")}
                >
                  Gasto
                </Button>
                <Button
                  type="button"
                  variant={selectedType === "income" ? "default" : "outline"}
                  onClick={() => selectType("income")}
                >
                  Ingreso
                </Button>
              </div>
              <FieldError errors={[errors.type]} />
            </Field>

            <Field data-invalid={!!errors.accountId}>
              <FieldLabel htmlFor="transaction-account">Cuenta</FieldLabel>
              <Controller
                control={control}
                name="accountId"
                render={({ field }) => (
                  <AccountSelect
                    id="transaction-account"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.accountId]} />
            </Field>

            <Field data-invalid={!!errors.categoryId}>
              <FieldLabel htmlFor="transaction-category">
                Categoría
              </FieldLabel>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <CategorySelect
                    id="transaction-category"
                    type={selectedType}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.categoryId]} />
            </Field>

            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="transaction-amount">Monto</FieldLabel>
              <Input
                id="transaction-amount"
                type="number"
                inputMode="decimal"
                aria-invalid={!!errors.amount}
                {...register("amount", { valueAsNumber: true })}
              />
              <FieldError errors={[errors.amount]} />
            </Field>

            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="transaction-date">Fecha</FieldLabel>
              <Input
                id="transaction-date"
                type="date"
                aria-invalid={!!errors.date}
                {...register("date")}
              />
              <FieldError errors={[errors.date]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="transaction-description">
                Descripción (opcional)
              </FieldLabel>
              <Input
                id="transaction-description"
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            {canDefer && (
              <Field data-invalid={!!errors.installmentCount}>
                <FieldLabel htmlFor="transaction-installments">
                  Diferir a cuotas (opcional)
                </FieldLabel>
                <Input
                  id="transaction-installments"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={48}
                  placeholder="Sin diferir"
                  aria-invalid={!!errors.installmentCount}
                  {...register("installmentCount", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  El saldo de la tarjeta baja igual por la compra completa — tu
                  cupo también. Lo que cambia es cuánto te cobra el extracto de
                  cada mes.
                </p>
                <FieldError errors={[errors.installmentCount]} />
              </Field>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>

      <InsufficientFundsDialog
        context={shortfall}
        onClose={() => setShortfall(null)}
        onResolved={() => {
          // The money is accounted for; the expense that was refused can now go
          // through. Retried from the live form values, not from a snapshot, so
          // nothing the user changed in the meantime is lost.
          setShortfall(null);
          void submitValues(getValues());
        }}
        onWrongAccount={() => {
          // Leave the form open and untouched — they're going to pick another
          // account and submit again.
          setShortfall(null);
        }}
      />
    </Dialog>
  );
}
