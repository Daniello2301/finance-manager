"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validation/categories";

export interface Category {
  _id: string;
  userId: string;
  name: string;
  type: "income" | "expense";
  icon?: string;
  color?: string;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFilters {
  type?: "income" | "expense";
  includeArchived?: boolean;
}

async function parseJsonOrThrow(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Ocurrió un error inesperado");
  }
  return body;
}

function buildQuery(filters: CategoryFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useCategories(filters: CategoryFilters = {}) {
  return useQuery({
    queryKey: ["categories", filters],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch(`/api/categories${buildQuery(filters)}`);
      const body = await parseJsonOrThrow(res);
      return body.categories;
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput): Promise<Category> => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCategoryInput;
    }): Promise<Category> => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Category> => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const body = await parseJsonOrThrow(res);
      return body.category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
