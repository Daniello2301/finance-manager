"use client";

import { useEffect } from "react";
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
import { formatMoney, fromMinorUnits, toMinorUnits } from "@/lib/money";
import { isInsufficientFunds } from "@/lib/api-client";
import { confirmAction } from "@/lib/notifications";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "@/lib/validation/transactions";
import { isConfirmPending } from "@/stores/confirm.store";
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

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
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

  useEffect(() => {
    if (!isOpen) return;

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
    } else if (!isEditing) {
      reset({
        accountId: "",
        categoryId: "",
        type: "expense",
        amount: 0,
        date: todayIsoDate(),
        description: "",
      });
    }
  }, [isOpen, isEditing, editingTransaction, reset]);

  const selectType = (type: "income" | "expense") => {
    setValue("type", type, { shouldValidate: true });
    // Cleared here, not in a useEffect keyed on `selectedType` — an effect
    // would also fire during the initial reset() when editing, wiping out
    // the category that was just preloaded.
    setValue("categoryId", "");
  };

  const onSubmit = async (values: TransactionFormValues) => {
    const input = {
      accountId: values.accountId,
      categoryId: values.categoryId,
      type: values.type,
      amount: toMinorUnits(values.amount, "COP"),
      date: new Date(values.date),
      description: values.description || undefined,
    };

    const submit = (confirmOverdraft?: boolean) =>
      isEditing && editingTransactionId
        ? updateTransaction.mutateAsync({
            id: editingTransactionId,
            input: { ...input, confirmOverdraft },
          })
        : createTransaction.mutateAsync({ ...input, confirmOverdraft });

    try {
      await submit();
      close();
    } catch (error) {
      // The server is the authority on the balance — the cached one here can be
      // stale. So we don't pre-check: we let the write be rejected, then quote
      // the figure the server sent back and offer to go ahead anyway.
      if (isInsufficientFunds(error)) {
        const confirmed = await confirmAction({
          title: "Saldo insuficiente",
          text: `Esta cuenta solo tiene ${formatMoney(
            error.body.available,
            error.body.currency
          )} disponible. ¿Registrar la transacción de todos modos?`,
          confirmButtonText: "Sí, registrarla",
        });
        if (!confirmed) return;

        try {
          await submit(true);
          close();
          return;
        } catch (retryError) {
          setError("root", {
            message:
              retryError instanceof Error
                ? retryError.message
                : "Ocurrió un error. Intenta de nuevo.",
          });
          return;
        }
      }

      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error. Intenta de nuevo.",
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Never close while a confirmation raised from inside this form is
        // still awaiting an answer — see isConfirmPending.
        if (!open && !isConfirmPending()) close();
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
    </Dialog>
  );
}
