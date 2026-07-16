"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toMinorUnits } from "@/lib/money";
import {
  createAccountSchema,
  updateAccountSchema,
} from "@/lib/validation/accounts";
import { useAccountModalStore } from "@/stores/accountModal.store";
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
} from "@/hooks/useAccounts";
import { useSeedForm } from "@/hooks/useSeedForm";

const TYPE_OPTIONS = [
  { value: "bank", label: "Banco" },
  { value: "cash", label: "Efectivo" },
  { value: "credit_card", label: "Tarjeta de crédito" },
] as const;

/**
 * An empty number input, read with `valueAsNumber`, yields NaN — not undefined.
 * NaN is a number, so Zod's `.optional()` doesn't save you: `.int()` rejects it
 * and the form refuses to submit, with an error on a field the user deliberately
 * left blank. That's what made a credit card with no credit limit unsavable, and
 * it would have done the same to every card that has no billing cycle.
 */
function optionalNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

interface AccountFormValues {
  name: string;
  type: "bank" | "cash" | "credit_card";
  initialBalance?: number;
  creditLimit?: number;
  statementDay?: number;
  paymentDay?: number;
}

export function AccountForm() {
  const isOpen = useAccountModalStore((state) => state.isOpen);
  const editingAccountId = useAccountModalStore(
    (state) => state.editingAccountId
  );
  const close = useAccountModalStore((state) => state.close);

  const { data: accounts } = useAccounts();
  const editingAccount = accounts?.find((a) => a._id === editingAccountId);
  const isEditing = Boolean(editingAccountId);

  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const isSubmitting = createAccount.isPending || updateAccount.isPending;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<AccountFormValues>({
    // createAccountSchema/updateAccountSchema infer slightly different
    // shapes (required vs. optional fields) than this component's single
    // AccountFormValues type — the form always supplies name/type, and the
    // fields each schema doesn't care about are simply not submitted, so
    // this cast is safe.
    resolver: zodResolver(
      isEditing ? updateAccountSchema : createAccountSchema
    ) as Resolver<AccountFormValues>,
  });

  const selectedType = watch("type");

  useSeedForm({
    isOpen,
    target: editingAccountId ?? "create",
    ready: !isEditing || Boolean(editingAccount),
    seed: () => {
      if (editingAccount) {
        reset({
          name: editingAccount.name,
          type: editingAccount.type,
          creditLimit: editingAccount.creditLimit,
          statementDay: editingAccount.statementDay,
          paymentDay: editingAccount.paymentDay,
        });
      } else {
        reset({ name: "", type: "bank", initialBalance: 0 });
      }
    },
  });

  const onSubmit = async (values: AccountFormValues) => {
    const creditLimitField =
      selectedType === "credit_card" && values.creditLimit !== undefined
        ? { creditLimit: toMinorUnits(values.creditLimit, "COP") }
        : {};

    // Both days or neither: one alone yields no cycle, and half a cycle would
    // let the app show a close date with no payment deadline, which is worse
    // than showing nothing.
    const cycleFields =
      selectedType === "credit_card" &&
      values.statementDay !== undefined &&
      values.paymentDay !== undefined
        ? { statementDay: values.statementDay, paymentDay: values.paymentDay }
        : {};

    try {
      if (isEditing && editingAccountId) {
        await updateAccount.mutateAsync({
          id: editingAccountId,
          input: {
            name: values.name,
            type: values.type,
            ...creditLimitField,
            ...cycleFields,
          },
        });
      } else {
        await createAccount.mutateAsync({
          name: values.name,
          type: values.type,
          currency: "COP",
          initialBalance: toMinorUnits(values.initialBalance ?? 0, "COP"),
          ...creditLimitField,
          ...cycleFields,
        });
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
            {isEditing ? "Editar cuenta" : "Nueva cuenta"}
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
              <FieldLabel htmlFor="account-name">Nombre</FieldLabel>
              <Input
                id="account-name"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.type}>
              <FieldLabel htmlFor="account-type">Tipo</FieldLabel>
              <Select
                id="account-type"
                aria-invalid={!!errors.type}
                {...register("type")}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError errors={[errors.type]} />
            </Field>

            {!isEditing && (
              <Field data-invalid={!!errors.initialBalance}>
                <FieldLabel htmlFor="account-initial-balance">
                  Saldo inicial
                </FieldLabel>
                <Input
                  id="account-initial-balance"
                  type="number"
                  inputMode="decimal"
                  aria-invalid={!!errors.initialBalance}
                  {...register("initialBalance", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.initialBalance]} />
              </Field>
            )}

            {selectedType === "credit_card" && (
              <Field data-invalid={!!errors.creditLimit}>
                <FieldLabel htmlFor="account-credit-limit">
                  Límite de crédito
                </FieldLabel>
                <Input
                  id="account-credit-limit"
                  type="number"
                  inputMode="decimal"
                  aria-invalid={!!errors.creditLimit}
                  {...register("creditLimit", { setValueAs: optionalNumber })}
                />
                <FieldError errors={[errors.creditLimit]} />
              </Field>
            )}

            {selectedType === "credit_card" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field data-invalid={!!errors.statementDay}>
                    <FieldLabel htmlFor="account-statement-day">
                      Día de corte
                    </FieldLabel>
                    <Input
                      id="account-statement-day"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      aria-invalid={!!errors.statementDay}
                      {...register("statementDay", {
                        setValueAs: optionalNumber,
                      })}
                    />
                    <FieldError errors={[errors.statementDay]} />
                  </Field>
                  <Field data-invalid={!!errors.paymentDay}>
                    <FieldLabel htmlFor="account-payment-day">
                      Día de pago
                    </FieldLabel>
                    <Input
                      id="account-payment-day"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      aria-invalid={!!errors.paymentDay}
                      {...register("paymentDay", { setValueAs: optionalNumber })}
                    />
                    <FieldError errors={[errors.paymentDay]} />
                  </Field>
                </div>
                <p className="-mt-1 text-xs text-muted-foreground">
                  Están en tu extracto. Sin los dos, la app no puede decirte
                  cuánto pagar ni hasta cuándo — y no se lo va a inventar.
                </p>
              </>
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
    </Dialog>
  );
}
