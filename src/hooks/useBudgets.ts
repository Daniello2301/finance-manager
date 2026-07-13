"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@/lib/validation/budgets";

export interface Budget {
  _id: string;
  userId: string;
  categoryId: string;
  periodKey: string;
  periodStart: string;
  limitAmount: number;
  currency: string;
  spentAmount: number;
  percentUsed: number;
  createdAt: string;
  updatedAt: string;
}

async function parseJsonOrThrow(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? "Ocurrió un error inesperado");
  }
  return body;
}

export function useBudgets(period: string) {
  return useQuery({
    queryKey: ["budgets", period],
    queryFn: async (): Promise<Budget[]> => {
      const res = await fetch(
        `/api/budgets?period=${encodeURIComponent(period)}`
      );
      const body = await parseJsonOrThrow(res);
      return body.budgets;
    },
    enabled: !!period,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBudgetInput): Promise<Budget> => {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.budget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateBudgetInput;
    }): Promise<Budget> => {
      const res = await fetch(`/api/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.budget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      await parseJsonOrThrow(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useCopyBudgets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fromPeriod,
      toPeriod,
    }: {
      fromPeriod: string;
      toPeriod: string;
    }): Promise<Budget[]> => {
      const res = await fetch("/api/budgets/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPeriod, toPeriod }),
      });
      const body = await parseJsonOrThrow(res);
      return body.budgets;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
