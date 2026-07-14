"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { formatMoney, toMinorUnits } from "@/lib/money";
import { isInsufficientFunds } from "@/lib/api-client";
import {
  InsufficientFundsDialog,
  type InsufficientFunds,
} from "@/components/InsufficientFundsDialog";
import { useDebtModalStore } from "@/stores/debtModal.store";
import { useDebts, usePayDebt } from "@/hooks/useDebts";

interface PaymentFormValues {
  accountId: string;
  categoryId: string;
  amount: string;
  date: string;
  description: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DebtPaymentForm() {
  const payingDebtId = useDebtModalStore((state) => state.payingDebtId);
  const close = useDebtModalStore((state) => state.close);

  const { data: debts } = useDebts(true);
  const entry = debts?.find((item) => item.debt._id === payingDebtId);

  const payDebt = usePayDebt();

  // Account and category live in the form, not in their own useState — a
  // separate setState called from the reset effect triggers a cascading render
  // (and eslint rightly rejects it). Controller is how TransactionForm already
  // wires these two selects.
  const [shortfall, setShortfall] = useState<InsufficientFunds | null>(null);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<PaymentFormValues>();

  const installmentAmount = entry?.debt.installmentAmount;

  useEffect(() => {
    if (!payingDebtId) return;
    reset({
      accountId: "",
      categoryId: "",
      // Prefill with the instalment, since that's what a payment usually is.
      amount: installmentAmount ? installmentAmount.toString() : "",
      date: today(),
      description: "",
    });
  }, [payingDebtId, installmentAmount, reset]);

  const submitValues = async (values: PaymentFormValues) => {
    if (!payingDebtId) return;

    const input = {
      accountId: values.accountId,
      categoryId: values.categoryId,
      amount: toMinorUnits(Number(values.amount), "COP"),
      date: new Date(values.date),
      description: values.description.trim() || undefined,
    };

    try {
      await payDebt.mutateAsync({ debtId: payingDebtId, input });
      close();
    } catch (error) {
      // A debt payment is an ordinary expense, so it hits the same rule as any
      // other — and gets the same fork: paying a debt with money you don't have
      // means the money came from somewhere, and we ask where.
      if (isInsufficientFunds(error)) {
        setShortfall({
          accountId: values.accountId,
          available: error.body.available,
          currency: error.body.currency,
          attempted: input.amount,
          description: entry?.debt.name,
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

  const onSubmit = (values: PaymentFormValues) => submitValues(values);

  return (
    <Dialog
      open={Boolean(payingDebtId)}
      onOpenChange={(open) => {
        // Never close while the insufficient-funds fork raised from inside this
        // form is still open — it would discard what the user typed.
        if (!open && !shortfall) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Registrar pago{entry ? ` — ${entry.debt.name}` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            {entry?.state.monthlyInterest !== null &&
              entry?.state.monthlyInterest !== undefined && (
                <Alert>
                  <AlertDescription>
                    Los intereses de este mes son{" "}
                    <strong className="font-tabular">
                      {formatMoney(entry.state.monthlyInterest, "COP")}
                    </strong>
                    . Todo lo que pagues por encima de esa cifra baja la deuda.
                  </AlertDescription>
                </Alert>
              )}

            <Field data-invalid={!!errors.accountId}>
              <FieldLabel htmlFor="payment-account">Cuenta</FieldLabel>
              <Controller
                control={control}
                name="accountId"
                rules={{ required: "Elige la cuenta desde la que pagas" }}
                render={({ field }) => (
                  <AccountSelect
                    id="payment-account"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.accountId]} />
            </Field>

            <Field data-invalid={!!errors.categoryId}>
              <FieldLabel htmlFor="payment-category">Categoría</FieldLabel>
              <Controller
                control={control}
                name="categoryId"
                rules={{ required: "Elige una categoría para el pago" }}
                render={({ field }) => (
                  <CategorySelect
                    id="payment-category"
                    type="expense"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.categoryId]} />
            </Field>

            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="payment-amount">Monto</FieldLabel>
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                aria-invalid={!!errors.amount}
                {...register("amount", {
                  required: "El monto es obligatorio",
                })}
              />
              <FieldError errors={[errors.amount]} />
            </Field>

            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="payment-date">Fecha</FieldLabel>
              <Input
                id="payment-date"
                type="date"
                aria-invalid={!!errors.date}
                {...register("date", { required: "La fecha es obligatoria" })}
              />
              <FieldError errors={[errors.date]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="payment-description">
                Descripción (opcional)
              </FieldLabel>
              <Input id="payment-description" {...register("description")} />
            </Field>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={payDebt.isPending}>
                {payDebt.isPending ? "Guardando..." : "Registrar pago"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>

      <InsufficientFundsDialog
        context={shortfall}
        onClose={() => setShortfall(null)}
        onResolved={() => {
          setShortfall(null);
          void submitValues(getValues());
        }}
        onWrongAccount={() => setShortfall(null)}
      />
    </Dialog>
  );
}
