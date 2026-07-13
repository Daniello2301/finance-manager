"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  useArchiveCategory,
  useCategories,
  useUnarchiveCategory,
} from "@/hooks/useCategories";
import { useCategoryModalStore } from "@/stores/categoryModal.store";
import { cn } from "@/lib/utils";

export function CategoryList() {
  const [activeType, setActiveType] = useState<"income" | "expense">(
    "expense"
  );
  const [showArchived, setShowArchived] = useState(false);
  const {
    data: categories,
    isLoading,
    isError,
  } = useCategories({ type: activeType, includeArchived: showArchived });
  const openEdit = useCategoryModalStore((state) => state.openEdit);
  const archiveCategory = useArchiveCategory();
  const unarchiveCategory = useUnarchiveCategory();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
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
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto"
          onClick={() => setShowArchived((current) => !current)}
          aria-pressed={showArchived}
        >
          {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
        </Button>
      </div>

      {isLoading && (
        <ListSkeleton rows={5} />
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
                className={cn(
                  "flex items-center justify-between px-4 py-2",
                  category.isArchived && "opacity-60"
                )}
              >
                <span className="min-w-0 truncate">
                  {category.name}
                  {category.isArchived && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      Archivada
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 gap-2">
                  {category.isArchived ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unarchiveCategory.mutate(category._id)}
                      disabled={unarchiveCategory.isPending}
                    >
                      Desarchivar
                    </Button>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
