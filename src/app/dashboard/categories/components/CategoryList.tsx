"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useArchiveCategory, useCategories } from "@/hooks/useCategories";
import { useCategoryModalStore } from "@/stores/categoryModal.store";

export function CategoryList() {
  const [activeType, setActiveType] = useState<"income" | "expense">(
    "expense"
  );
  const {
    data: categories,
    isLoading,
    isError,
  } = useCategories({ type: activeType });
  const openEdit = useCategoryModalStore((state) => state.openEdit);
  const archiveCategory = useArchiveCategory();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          variant={activeType === "expense" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveType("expense")}
        >
          Gastos
        </Button>
        <Button
          variant={activeType === "income" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveType("income")}
        >
          Ingresos
        </Button>
      </div>

      {isLoading && (
        <p className="text-muted-foreground">Cargando categorías...</p>
      )}

      {isError && (
        <p className="text-destructive">
          No se pudieron cargar tus categorías. Intenta de nuevo.
        </p>
      )}

      {!isLoading && !isError && categories && categories.length === 0 && (
        <p className="text-muted-foreground">
          Todavía no tienes categorías de{" "}
          {activeType === "expense" ? "gasto" : "ingreso"}.
        </p>
      )}

      {categories && categories.length > 0 && (
        <Card>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            {categories.map((category) => (
              <div
                key={category._id}
                className="flex items-center justify-between px-4 py-2"
              >
                <span>{category.name}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(category._id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => archiveCategory.mutate(category._id)}
                    disabled={archiveCategory.isPending}
                  >
                    Archivar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
