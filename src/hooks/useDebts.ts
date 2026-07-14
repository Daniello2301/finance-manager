"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import { notifyErrorFrom } from "@/lib/notifications";
import type {
  CreateDebtInput,
  CreateDebtPaymentInput,
  UpdateDebtInput,
} from "@/lib/validation/debts";

export interface Debt {
  _id: string;
  userId: string;
  name: string;
  creditor?: string;
  principal?: number;
  /** Decimal fraction: 0.015 = 1.5% a month. Never a percentage. */
  monthlyRate?: number;
  installmentAmount?: number;
  installmentCount?: number;
  accountNumber?: string;
  startDate?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SplitPayment {
  _id?: string;
  amount: number;
  date: string;
  /** null when there isn't enough information to split it. */
  interest: number | null;
  principal: number | null;
  coversInterest: boolean;
}

export interface DebtState {
  /** null means "we don't know", NOT "you owe nothing". Never render it as 0. */
  outstanding: number | null;
  arrears: number;
  totalPaid: number;
  totalToInterest: number;
  totalToPrincipal: number;
  monthlyInterest: number | null;
  underpaid: boolean;
  payments: SplitPayment[];
}

export interface DebtWithState {
  debt: Debt;
  state: DebtState;
  rate: { rate: number; estimated: boolean } | null;
}

export interface DebtSummary {
  monthlyDue: number;
  paidThisMonth: number;
  totalOutstanding: number;
  unknownCount: number;
  debtsInArrears: number;
  activeCount: number;
}

export function useDebts(includeArchived = false) {
  return useQuery({
    queryKey: ["debts", { includeArchived }],
    queryFn: async (): Promise<DebtWithState[]> => {
      const res = await fetch(
        `/api/debts${includeArchived ? "?includeArchived=true" : ""}`
      );
      const body = await parseJsonOrThrow(res);
      return body.debts;
    },
  });
}

export function useDebt(id: string | null) {
  return useQuery({
    queryKey: ["debts", id],
    enabled: !!id,
    queryFn: async (): Promise<DebtWithState> => {
      const res = await fetch(`/api/debts/${id}`);
      return parseJsonOrThrow(res);
    },
  });
}

export function useDebtSummary() {
  return useQuery({
    queryKey: ["dashboard", "debts"],
    queryFn: async (): Promise<DebtSummary> => {
      const res = await fetch("/api/dashboard/debts");
      return parseJsonOrThrow(res);
    },
    staleTime: 60_000,
  });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDebtInput): Promise<Debt> => {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateDebtInput;
    }): Promise<Debt> => {
      const res = await fetch(`/api/debts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useArchiveDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Debt> => {
      const res = await fetch(`/api/debts/${id}`, { method: "DELETE" });
      const body = await parseJsonOrThrow(res);
      return body.debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => notifyErrorFrom(error, "No se pudo archivar la deuda."),
  });
}

export function useUnarchiveDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Debt> => {
      const res = await fetch(`/api/debts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      const body = await parseJsonOrThrow(res);
      return body.debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo desarchivar la deuda."),
  });
}

export function usePayDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      debtId,
      input,
    }: {
      debtId: string;
      input: CreateDebtPaymentInput;
    }) => {
      const res = await fetch(`/api/debts/${debtId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      // A payment is a real transaction against a real account — everything that
      // reads either of those is now stale.
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
