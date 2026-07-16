"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import { notifyErrorFrom } from "@/lib/notifications";
import type {
  CreateRecurringInput,
  UpdateRecurringInput,
} from "@/lib/validation/recurring";
import type { RecurrenceFrequency } from "@/lib/models/RecurringTransaction";

export interface Recurring {
  _id: string;
  userId: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  accountId: string;
  categoryId: string;
  frequency: RecurrenceFrequency;
  anchorDay: number;
  startDate: string;
  nextDueDate: string;
  autoGenerate: boolean;
  endDate?: string;
  isPaused: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingConfirmation {
  recurringId: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  accountId: string;
  categoryId: string;
  occurrenceKey: string;
  date: string;
  overdueCount: number;
}

export function useRecurring(includeArchived = false) {
  return useQuery({
    queryKey: ["recurring", { includeArchived }],
    queryFn: async (): Promise<Recurring[]> => {
      const res = await fetch(
        `/api/recurring${includeArchived ? "?includeArchived=true" : ""}`
      );
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
  });
}

export function useRecurringItem(id: string | null) {
  return useQuery({
    queryKey: ["recurring", id],
    enabled: !!id,
    queryFn: async (): Promise<Recurring> => {
      const res = await fetch(`/api/recurring/${id}`);
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecurringInput): Promise<Recurring> => {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateRecurringInput;
    }): Promise<Recurring> => {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Pause or resume — resuming recomputes the next due date forward (FR-008). */
export function usePauseRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPaused }: { id: string; isPaused: boolean }) => {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaused }),
      });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo cambiar el estado del recurrente."),
  });
}

export function useArchiveRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Recurring> => {
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo archivar el recurrente."),
  });
}

export function useUnarchiveRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Recurring> => {
      const res = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo desarchivar el recurrente."),
  });
}

export function useConfirmOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      occurrenceKey,
      amount,
    }: {
      id: string;
      occurrenceKey: string;
      amount?: number;
    }) => {
      const res = await fetch(`/api/recurring/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceKey, amount }),
      });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      // A confirm writes a real transaction against a real account.
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSkipOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      occurrenceKey,
    }: {
      id: string;
      occurrenceKey: string;
    }) => {
      const res = await fetch(`/api/recurring/${id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceKey }),
      });
      const body = await parseJsonOrThrow(res);
      return body.recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      notifyErrorFrom(error, "No se pudo saltar el vencimiento."),
  });
}

/**
 * Materialises the automatic templates that came due, and returns the manual
 * ones still pending. Fired once on dashboard load — idempotent server-side.
 */
export function useCatchUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{
      created: number;
      pending: PendingConfirmation[];
    }> => {
      const res = await fetch("/api/recurring/catch-up", { method: "POST" });
      return parseJsonOrThrow(res);
    },
    onSuccess: ({ created }) => {
      // Only bust the money caches if something was actually generated.
      if (created > 0) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
  });
}
