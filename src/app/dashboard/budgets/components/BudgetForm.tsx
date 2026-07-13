"use client";

import { useEffect, useRef } from "react";
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
import { CategorySelect } from "@/components/CategorySelect";
import {
  createBudgetSchema,
  updateBudgetSchema,
} from "@/lib/validation/budgets";
import { useBudgetModalStore } from "@/stores/budgetModal.store";
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
} from "@/hooks/useBudgets";

interface BudgetFormValues {
  categoryId: string;
  periodKey: string;
  limitAmount: number;
}

export function BudgetForm({ period }: { period: string }) {
  const isOpen = useBudgetModalStore((state) => state.isOpen);
  const editingBudgetId = useBudgetModalStore(
    (state) => state.editingBudgetId
  );
  const close = useBudgetModalStore((state) => state.close);

  const { data: budgets } = useBudgets(period);
  const editingBudget = budgets?.find((b) => b._id === editingBudgetId);
  const isEditing = Boolean(editingBudgetId);

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const isSubmitting = createBudget.isPending || updateBudget.isPending;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    // createBudgetSchema/updateBudgetSchema infer different shapes than
    // this component's single BudgetFormValues type (same cast pattern as
    // AccountForm.tsx/TransactionForm.tsx) — periodKey/categoryId are
    // simply ignored by updateBudgetSchema's parse in edit mode.
    resolver: zodResolver(
      isEditing ? updateBudgetSchema : createBudgetSchema
    ) as unknown as Resolver<BudgetFormValues>,
  });

  // Tracks which budget (or "create") the form was last reset() for, so a
  // background refetch of useBudgets while the modal is open — no staleTime
  // is set on that query — doesn't silently wipe an in-progress edit. Only
  // a real open/close cycle or switching to a different budget re-seeds it.
  const initializedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedForRef.current = null;
      return;
    }

    const key = editingBudgetId ?? "create";
    if (initializedForRef.current === key) return;

    if (isEditing) {
      if (!editingBudget) return;
      reset({
        categoryId: editingBudget.categoryId,
        periodKey: editingBudget.periodKey,
        limitAmount: editingBudget.limitAmount,
      });
    } else {
      reset({ categoryId: "", periodKey: period, limitAmount: 0 });
    }
    initializedForRef.current = key;
  }, [isOpen, isEditing, editingBudget, editingBudgetId, period, reset]);

  const onSubmit = async (values: BudgetFormValues) => {
    try {
      if (isEditing && editingBudgetId) {
        await updateBudget.mutateAsync({
          id: editingBudgetId,
          input: { limitAmount: values.limitAmount },
        });
      } else {
        await createBudget.mutateAsync({
          categoryId: values.categoryId,
          periodKey: values.periodKey,
          limitAmount: values.limitAmount,
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
            {isEditing ? "Editar presupuesto" : "Nuevo presupuesto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            {!isEditing && (
              <Field data-invalid={!!errors.categoryId}>
                <FieldLabel htmlFor="budget-category">Categoría</FieldLabel>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <CategorySelect
                      id="budget-category"
                      type="expense"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[errors.categoryId]} />
              </Field>
            )}

            <Field data-invalid={!!errors.limitAmount}>
              <FieldLabel htmlFor="budget-limit">Límite mensual</FieldLabel>
              <Input
                id="budget-limit"
                type="number"
                inputMode="decimal"
                aria-invalid={!!errors.limitAmount}
                {...register("limitAmount", { valueAsNumber: true })}
              />
              <FieldError errors={[errors.limitAmount]} />
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
