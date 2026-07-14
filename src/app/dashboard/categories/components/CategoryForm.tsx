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
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validation/categories";
import { useSeedForm } from "@/hooks/useSeedForm";
import { useCategoryModalStore } from "@/stores/categoryModal.store";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/useCategories";

const TYPE_OPTIONS = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
] as const;

interface CategoryFormValues {
  name: string;
  type: "income" | "expense";
}

export function CategoryForm() {
  const isOpen = useCategoryModalStore((state) => state.isOpen);
  const editingCategoryId = useCategoryModalStore(
    (state) => state.editingCategoryId
  );
  const close = useCategoryModalStore((state) => state.close);

  const { data: categories } = useCategories({ includeArchived: true });
  const editingCategory = categories?.find(
    (c) => c._id === editingCategoryId
  );
  const isEditing = Boolean(editingCategoryId);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isSubmitting = createCategory.isPending || updateCategory.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    // createCategorySchema/updateCategorySchema infer slightly different
    // shapes than this component's single CategoryFormValues type — the
    // form always supplies name/type, and type is never actually
    // submitted on update, so this cast is safe (same pattern as
    // AccountForm.tsx).
    resolver: zodResolver(
      isEditing ? updateCategorySchema : createCategorySchema
    ) as Resolver<CategoryFormValues>,
  });

  useSeedForm({
    isOpen,
    target: editingCategoryId ?? "create",
    ready: !isEditing || Boolean(editingCategory),
    seed: () => {
      if (editingCategory) {
        reset({ name: editingCategory.name, type: editingCategory.type });
      } else {
        reset({ name: "", type: "expense" });
      }
    },
  });

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      if (isEditing && editingCategoryId) {
        await updateCategory.mutateAsync({
          id: editingCategoryId,
          input: { name: values.name },
        });
      } else {
        await createCategory.mutateAsync({
          name: values.name,
          type: values.type,
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
            {isEditing ? "Editar categoría" : "Nueva categoría"}
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
              <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
              <Input
                id="category-name"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.type}>
              <FieldLabel htmlFor="category-type">Tipo</FieldLabel>
              <Select
                id="category-type"
                aria-invalid={!!errors.type}
                disabled={isEditing}
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
