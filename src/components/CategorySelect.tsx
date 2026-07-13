"use client";

import { useCategories } from "@/hooks/useCategories";
import { Select } from "@/components/ui/select";

interface CategorySelectProps {
  value?: string;
  onChange: (categoryId: string) => void;
  type?: "income" | "expense";
  id?: string;
  disabled?: boolean;
}

/**
 * Cross-module select — built here (Categorías) but shared by Transacciones
 * and Presupuestos once those modules exist (Presupuestos filters
 * type="expense"). useCategories() already excludes archived categories by
 * default, so no extra filtering needed. Grouped by type via <optgroup>
 * when no `type` filter is given.
 */
export function CategorySelect({
  value,
  onChange,
  type,
  id,
  disabled,
}: CategorySelectProps) {
  const { data: categories, isLoading } = useCategories({ type });

  const income = categories?.filter((c) => c.type === "income") ?? [];
  const expense = categories?.filter((c) => c.type === "expense") ?? [];

  return (
    <Select
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || isLoading}
    >
      <option value="" disabled>
        {isLoading ? "Cargando categorías..." : "Selecciona una categoría"}
      </option>
      {type
        ? categories?.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))
        : [
            income.length > 0 && (
              <optgroup key="income" label="Ingresos">
                {income.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ),
            expense.length > 0 && (
              <optgroup key="expense" label="Gastos">
                {expense.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ),
          ]}
    </Select>
  );
}
