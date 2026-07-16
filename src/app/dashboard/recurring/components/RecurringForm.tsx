"use client";

import { Controller, useForm } from "react-hook-form";
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
import { AccountSelect } from "@/components/AccountSelect";
import { CategorySelect } from "@/components/CategorySelect";
import { fromMinorUnits, toMinorUnits } from "@/lib/money";
import { useSeedForm } from "@/hooks/useSeedForm";
import { useRecurringModalStore } from "@/stores/recurringModal.store";
import {
  useCreateRecurring,
  useRecurring,
  useUpdateRecurring,
} from "@/hooks/useRecurring";

interface RecurringFormValues {
  name: string;
  type: "income" | "expense";
  amount: string;
  accountId: string;
  categoryId: string;
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  startDate: string;
  autoGenerate: boolean;
  endDate: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY: RecurringFormValues = {
  name: "",
  type: "expense",
  amount: "",
  accountId: "",
  categoryId: "",
  frequency: "monthly",
  startDate: todayIsoDate(),
  autoGenerate: false,
  endDate: "",
};

export function RecurringForm() {
  const isOpen = useRecurringModalStore((state) => state.isOpen);
  const editingId = useRecurringModalStore((state) => state.editingRecurringId);
  const close = useRecurringModalStore((state) => state.close);

  const isEditing = Boolean(editingId);
  const { data: recurring } = useRecurring(true);
  const editing = recurring?.find((entry) => entry._id === editingId);

  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const isSubmitting = createRecurring.isPending || updateRecurring.isPending;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<RecurringFormValues>({ defaultValues: EMPTY });

  useSeedForm({
    isOpen,
    target: editingId ?? "create",
    ready: !isEditing || Boolean(editing),
    seed: () => {
      if (isEditing && editing) {
        reset({
          name: editing.name,
          type: editing.type,
          amount: fromMinorUnits(editing.amount, "COP").toString(),
          accountId: editing.accountId,
          categoryId: editing.categoryId,
          frequency: editing.frequency,
          startDate: editing.startDate.slice(0, 10),
          autoGenerate: editing.autoGenerate,
          endDate: editing.endDate ? editing.endDate.slice(0, 10) : "",
        });
      } else {
        reset(EMPTY);
      }
    },
  });

  const selectedType = watch("type");
  const autoGenerate = watch("autoGenerate");

  const selectType = (type: "income" | "expense") => {
    setValue("type", type, { shouldValidate: true });
    // Cleared here, not via a useEffect keyed on type — an effect would also fire
    // during the seeding reset() in edit mode and wipe the preloaded category.
    setValue("categoryId", "");
  };

  const onSubmit = async (values: RecurringFormValues) => {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("amount", { message: "El monto debe ser mayor que cero." });
      return;
    }

    const input = {
      name: values.name.trim(),
      type: values.type,
      amount: toMinorUnits(amount, "COP"),
      accountId: values.accountId,
      categoryId: values.categoryId,
      frequency: values.frequency,
      startDate: new Date(values.startDate),
      autoGenerate: values.autoGenerate,
      endDate: values.endDate ? new Date(values.endDate) : undefined,
    };

    try {
      if (isEditing && editingId) {
        await updateRecurring.mutateAsync({ id: editingId, input });
      } else {
        await createRecurring.mutateAsync(input);
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
            {isEditing ? "Editar recurrente" : "Nuevo recurrente"}
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
            </Field>

            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="recurring-name">Nombre</FieldLabel>
              <Input
                id="recurring-name"
                placeholder="Arriendo, Netflix, Sueldo…"
                aria-invalid={!!errors.name}
                {...register("name", { required: "El nombre es obligatorio" })}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="recurring-amount">Monto</FieldLabel>
              <Input
                id="recurring-amount"
                type="number"
                inputMode="decimal"
                placeholder="1500000"
                aria-invalid={!!errors.amount}
                {...register("amount")}
              />
              <FieldError errors={[errors.amount]} />
            </Field>

            <Field data-invalid={!!errors.accountId}>
              <FieldLabel htmlFor="recurring-account">Cuenta</FieldLabel>
              <Controller
                control={control}
                name="accountId"
                rules={{ required: "Elige una cuenta" }}
                render={({ field }) => (
                  <AccountSelect
                    id="recurring-account"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.accountId]} />
            </Field>

            <Field data-invalid={!!errors.categoryId}>
              <FieldLabel htmlFor="recurring-category">Categoría</FieldLabel>
              <Controller
                control={control}
                name="categoryId"
                rules={{ required: "Elige una categoría" }}
                render={({ field }) => (
                  <CategorySelect
                    id="recurring-category"
                    type={selectedType}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.categoryId]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-frequency">Frecuencia</FieldLabel>
              <Select id="recurring-frequency" {...register("frequency")}>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Cada 2 semanas</option>
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-start">Desde</FieldLabel>
              <Input
                id="recurring-start"
                type="date"
                {...register("startDate", { required: true })}
              />
              <p className="text-xs text-muted-foreground">
                Ancla el día. El primer vencimiento será el primero de hoy en
                adelante — no se registra el pasado.
              </p>
            </Field>

            <Field>
              <FieldLabel>¿Cómo se cobra?</FieldLabel>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant={autoGenerate ? "default" : "outline"}
                  onClick={() => setValue("autoGenerate", true)}
                >
                  Se cobra solo (domiciliado)
                </Button>
                <Button
                  type="button"
                  variant={!autoGenerate ? "default" : "outline"}
                  onClick={() => setValue("autoGenerate", false)}
                >
                  Lo pago yo (confirmo cada mes)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {autoGenerate
                  ? "Se registrará solo al vencer, porque el dinero se mueve lo mires o no."
                  : "Al vencer aparece como pendiente y lo confirmas, pudiendo corregir el monto."}
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-end">
                Termina el (opcional)
              </FieldLabel>
              <Input id="recurring-end" type="date" {...register("endDate")} />
              <p className="text-xs text-muted-foreground">
                Para un plan a plazo fijo. Déjalo vacío si no termina.
              </p>
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
