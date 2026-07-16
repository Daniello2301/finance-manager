"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import { notifyErrorFrom, notifySuccess } from "@/lib/notifications";
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
  statementDay?: number;
  paymentDay?: number;
  color?: string;
  icon?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Statement {
  currentBalance: number;
  amountDue: number;
  due: string;
  close: string;
  nextClose: string;
  nextDue: string;
  currency: string;
}

/**
 * What a card demands by when — a different number from what it owes in total.
 *
 * Only asked for when the card has both cycle days: without them there is no
 * cycle, and the API says so rather than estimating one.
 */
export function useStatement(account: Account | null) {
  const enabled =
    account?.type === "credit_card" &&
    account.statementDay !== undefined &&
    account.paymentDay !== undefined;

  return useQuery({
    queryKey: ["accounts", account?._id, "statement"],
    enabled,
    queryFn: async (): Promise<Statement> => {
      const res = await fetch(`/api/accounts/${account!._id}/statement`);
      const body = await parseJsonOrThrow(res);
      return body.statement;
    },
  });
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
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo archivar la cuenta."),
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
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo desarchivar la cuenta."),
  });
}

/**
 * Recognises money the app didn't know the account had.
 *
 * This is the old `confirmOverdraft` in a better suit, and that's understood —
 * but an adjustment is WRITTEN DOWN, with an amount, a date and a category, so
 * it can be seen and questioned. The old escape hatch left a mute negative
 * balance and nothing to audit.
 */
export function useAdjustBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: { amount: number; description?: string };
    }) => {
      const res = await fetch(`/api/accounts/${id}/adjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo ajustar el saldo."),
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
      // Recomputing is idempotent: a correct balance looks exactly like an
      // untouched one, so without this the button gives no sign it ever ran.
      notifySuccess("Saldo recalculado.");
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo recalcular el saldo."),
  });
}
