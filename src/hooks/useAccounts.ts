"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@/lib/validation/accounts";

export interface Account {
  _id: string;
  userId: string;
  name: string;
  type: "bank" | "cash" | "credit_card";
  currency: string;
  initialBalance: number;
  currentBalance: number;
  creditLimit?: number;
  color?: string;
  icon?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useAccounts(includeArchived = false) {
  return useQuery({
    queryKey: ["accounts", { includeArchived }],
    queryFn: async (): Promise<Account[]> => {
      const res = await fetch(
        `/api/accounts${includeArchived ? "?includeArchived=true" : ""}`
      );
      const body = await parseJsonOrThrow(res);
      return body.accounts;
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAccountInput): Promise<Account> => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateAccountInput;
    }): Promise<Account> => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useArchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Account> => {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const body = await parseJsonOrThrow(res);
      return body.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUnarchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Account> => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      const body = await parseJsonOrThrow(res);
      return body.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      // An unarchived account is counted in the balance summary again.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRecomputeBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Account> => {
      const res = await fetch(`/api/accounts/${id}/recompute-balance`, {
        method: "POST",
      });
      const body = await parseJsonOrThrow(res);
      return body.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      // The dashboard's balance summary reads from Account.currentBalance
      // too — without this, a just-recomputed balance still shows stale on
      // /dashboard until the summary query's staleTime elapses.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
