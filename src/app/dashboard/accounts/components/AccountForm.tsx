"use client";

import { useEffect } from "react";
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

const TYPE_OPTIONS = [
  { value: "bank", label: "Banco" },
  { value: "cash", label: "Efectivo" },
  { value: "credit_card", label: "Tarjeta de crédito" },
] as const;

interface AccountFormValues {
  name: string;
  type: "bank" | "cash" | "credit_card";
  initialBalance?: number;
  creditLimit?: number;
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

  useEffect(() => {
    if (!isOpen) return;

    if (editingAccount) {
      reset({
        name: editingAccount.name,
        type: editingAccount.type,
        creditLimit: editingAccount.creditLimit,
      });
    } else {
      reset({ name: "", type: "bank", initialBalance: 0 });
    }
  }, [isOpen, editingAccount, reset]);

  const onSubmit = async (values: AccountFormValues) => {
    const creditLimitField =
      selectedType === "credit_card" && values.creditLimit !== undefined
        ? { creditLimit: toMinorUnits(values.creditLimit, "COP") }
        : {};

    try {
      if (isEditing && editingAccountId) {
        await updateAccount.mutateAsync({
          id: editingAccountId,
          input: { name: values.name, type: values.type, ...creditLimitField },
        });
      } else {
        await createAccount.mutateAsync({
          name: values.name,
          type: values.type,
          currency: "COP",
          initialBalance: toMinorUnits(values.initialBalance ?? 0, "COP"),
          ...creditLimitField,
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
                  {...register("creditLimit", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.creditLimit]} />
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
    </Dialog>
  );
}
