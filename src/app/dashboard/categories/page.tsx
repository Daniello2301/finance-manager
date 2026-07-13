"use client";

import { Button } from "@/components/ui/button";
import { useCategoryModalStore } from "@/stores/categoryModal.store";
import { CategoryForm } from "./components/CategoryForm";
import { CategoryList } from "./components/CategoryList";

export default function CategoriesPage() {
  const openCreate = useCategoryModalStore((state) => state.openCreate);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Categorías</h1>
        <Button onClick={openCreate}>Nueva categoría</Button>
      </div>
      <CategoryList />
      <CategoryForm />
    </div>
  );
}
