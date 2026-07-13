"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validation/transactions";

export interface Transaction {
  _id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransactionsPage {
  data: Transaction[];
  pagination: TransactionsPagination;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

function buildQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.type) params.set("type", filters.type);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async (): Promise<TransactionsPage> => {
      const res = await fetch(`/api/transactions${buildQuery(filters)}`);
      return parseJsonOrThrow(res);
    },
  });
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ["transactions", "detail", id],
    queryFn: async (): Promise<Transaction> => {
      const res = await fetch(`/api/transactions/${id}`);
      const body = await parseJsonOrThrow(res);
      return body.transaction;
    },
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateTransactionInput
    ): Promise<Transaction> => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTransactionInput;
    }): Promise<Transaction> => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });
      await parseJsonOrThrow(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
