"use client";

import { useQuery } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import type { Budget } from "@/hooks/useBudgets";
import type { Transaction } from "@/hooks/useTransactions";

export interface BalanceByCurrency {
  currency: string;
  total: number;
}

export interface DashboardSummary {
  balances: BalanceByCurrency[];
  topBudgets: Budget[];
}

export interface TrendEntry {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdownEntry {
  categoryId: string;
  categoryName: string;
  total: number;
}

const STALE_TIME_MS = 60000;

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async (): Promise<DashboardSummary> => {
      const res = await fetch("/api/dashboard/summary");
      return parseJsonOrThrow(res);
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useMonthlyTrend(months: number) {
  return useQuery({
    queryKey: ["dashboard", "trend", months],
    queryFn: async (): Promise<TrendEntry[]> => {
      const res = await fetch(`/api/dashboard/trend?months=${months}`);
      const body = await parseJsonOrThrow(res);
      return body.trend;
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useCategoryBreakdown(period: string) {
  return useQuery({
    queryKey: ["dashboard", "category-breakdown", period],
    queryFn: async (): Promise<CategoryBreakdownEntry[]> => {
      const res = await fetch(
        `/api/dashboard/category-breakdown?period=${encodeURIComponent(period)}`
      );
      const body = await parseJsonOrThrow(res);
      return body.breakdown;
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useRecentTransactions(limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "recent-transactions", limit],
    queryFn: async (): Promise<Transaction[]> => {
      const res = await fetch(
        `/api/dashboard/recent-transactions?limit=${limit}`
      );
      const body = await parseJsonOrThrow(res);
      return body.transactions;
    },
    staleTime: STALE_TIME_MS,
  });
}
