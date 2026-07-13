"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
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
import { toMinorUnits } from "@/lib/money";
import { deriveMonthlyRate } from "@/lib/debt-math";
import { useDebtModalStore } from "@/stores/debtModal.store";
import { useCreateDebt, useDebts, useUpdateDebt } from "@/hooks/useDebts";

/**
 * The form's rate field is a PERCENTAGE ("1.5" means 1.5% a month). Everything
 * below the form — the schema, the model, the maths — works in decimal fractions
 * (0.015). The conversion happens here and nowhere else: mistaking 1.5 for 0.015
 * is a hundred-fold error in someone's real debt, and the only defence is to have
 * exactly one line where the units change.
 */
const PERCENT_TO_FRACTION = 100;

interface DebtFormValues {
  name: string;
  creditor: string;
  principal: string;
  ratePercent: string;
  installmentAmount: string;
  installmentCount: string;
  accountNumber: string;
  startDate: string;
}

const EMPTY: DebtFormValues = {
  name: "",
  creditor: "",
  principal: "",
  ratePercent: "",
  installmentAmount: "",
  installmentCount: "",
  accountNumber: "",
  startDate: "",
};

/** "" → undefined, so an untouched optional field isn't sent as 0. */
function num(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DebtForm() {
  const isOpen = useDebtModalStore((state) => state.isOpen);
  const editingDebtId = useDebtModalStore((state) => state.editingDebtId);
  const close = useDebtModalStore((state) => state.close);

  const { data: debts } = useDebts(true);
  const editing = debts?.find((entry) => entry.debt._id === editingDebtId);
  const isEditing = Boolean(editingDebtId);

  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const isSubmitting = createDebt.isPending || updateDebt.isPending;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<DebtFormValues>({ defaultValues: EMPTY });

  // Guarded against re-running on every background refetch of useDebts — an
  // unguarded effect keyed on `editing` wipes whatever the user is typing the
  // moment the query refreshes. (Same bug BudgetForm already had fixed.)
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      initializedFor.current = null;
      return;
    }
    const key = editingDebtId ?? "new";
    if (initializedFor.current === key) return;

    if (editing) {
      const debt = editing.debt;
      reset({
        name: debt.name,
        creditor: debt.creditor ?? "",
        principal: debt.principal?.toString() ?? "",
        ratePercent:
          debt.monthlyRate !== undefined
            ? (debt.monthlyRate * PERCENT_TO_FRACTION).toString()
            : "",
        installmentAmount: debt.installmentAmount?.toString() ?? "",
        installmentCount: debt.installmentCount?.toString() ?? "",
        accountNumber: debt.accountNumber ?? "",
        startDate: debt.startDate ? debt.startDate.slice(0, 10) : "",
      });
      initializedFor.current = key;
    } else if (!editingDebtId) {
      reset(EMPTY);
      initializedFor.current = key;
    }
  }, [isOpen, editingDebtId, editing, reset]);

  // Solve the rate live, so the user sees it appear the moment the three figures
  // that determine it are present. Runs in the browser — which is exactly why
  // debt-math.ts must never import mongoose.
  const principal = num(watch("principal"));
  const installmentAmount = num(watch("installmentAmount"));
  const installmentCount = num(watch("installmentCount"));
  const typedRate = num(watch("ratePercent"));

  const derived =
    typedRate === undefined
      ? deriveMonthlyRate(
          principal !== undefined
            ? toMinorUnits(principal, "COP")
            : undefined,
          installmentAmount !== undefined
            ? toMinorUnits(installmentAmount, "COP")
            : undefined,
          installmentCount
        )
      : null;

  const onSubmit = async (values: DebtFormValues) => {
    const ratePercent = num(values.ratePercent);
    const principalValue = num(values.principal);
    const installment = num(values.installmentAmount);

    const input = {
      name: values.name.trim(),
      creditor: values.creditor.trim() || undefined,
      principal:
        principalValue !== undefined
          ? toMinorUnits(principalValue, "COP")
          : undefined,
      // The one and only place a percentage becomes a fraction.
      monthlyRate:
        ratePercent !== undefined
          ? ratePercent / PERCENT_TO_FRACTION
          : undefined,
      installmentAmount:
        installment !== undefined ? toMinorUnits(installment, "COP") : undefined,
      installmentCount: num(values.installmentCount),
      accountNumber: values.accountNumber.trim() || undefined,
      startDate: values.startDate ? new Date(values.startDate) : undefined,
    };

    try {
      if (isEditing && editingDebtId) {
        await updateDebt.mutateAsync({ id: editingDebtId, input });
      } else {
        await createDebt.mutateAsync(input);
      }
      close();
    } catch (error) {
      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error. Intenta de nuevo.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar deuda" : "Nueva deuda"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="debt-name">Nombre</FieldLabel>
              <Input
                id="debt-name"
                placeholder="Crédito moto"
                aria-invalid={!!errors.name}
                {...register("name", {
                  required: "El nombre es obligatorio",
                })}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-creditor">
                Acreedor (opcional)
              </FieldLabel>
              <Input
                id="debt-creditor"
                placeholder="Banco, ADDI, una persona…"
                {...register("creditor")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-principal">
                Monto original (opcional)
              </FieldLabel>
              <Input
                id="debt-principal"
                type="number"
                inputMode="decimal"
                placeholder="17000000"
                {...register("principal")}
              />
              <p className="text-xs text-muted-foreground">
                Sin este dato no se pueden calcular intereses, pero la deuda se
                guarda igual.
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-rate">
                Tasa de interés mensual (opcional)
              </FieldLabel>
              <Input
                id="debt-rate"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="1.5"
                {...register("ratePercent")}
              />
              <p className="text-xs text-muted-foreground">
                En porcentaje. Escribe 1.5 para 1,5% mensual.
              </p>
              {derived !== null && (
                <Alert>
                  <AlertDescription>
                    No pusiste la tasa, pero con el monto, la cuota y el número
                    de cuotas la calculé:{" "}
                    <strong>
                      {(derived * PERCENT_TO_FRACTION).toFixed(2)}% mensual
                    </strong>{" "}
                    (estimada — no es un dato de tu contrato).
                  </AlertDescription>
                </Alert>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-installment">
                Valor de la cuota (opcional)
              </FieldLabel>
              <Input
                id="debt-installment"
                type="number"
                inputMode="decimal"
                placeholder="500000"
                {...register("installmentAmount")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-installment-count">
                Número de cuotas (opcional)
              </FieldLabel>
              <Input
                id="debt-installment-count"
                type="number"
                inputMode="numeric"
                placeholder="24"
                {...register("installmentCount")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-start">
                Fecha de inicio (opcional)
              </FieldLabel>
              <Input id="debt-start" type="date" {...register("startDate")} />
              <p className="text-xs text-muted-foreground">
                Desde cuándo corren los intereses.
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="debt-account-number">
                Número de cuenta para pagar (opcional)
              </FieldLabel>
              <Input
                id="debt-account-number"
                placeholder="Para tenerlo a mano al transferir"
                {...register("accountNumber")}
              />
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
