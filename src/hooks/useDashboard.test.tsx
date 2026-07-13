import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useCategoryBreakdown,
  useDashboardSummary,
  useMonthlyTrend,
  useRecentTransactions,
} from "@/hooks/useDashboard";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("useDashboard hooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useDashboardSummary fetches balances and top budgets", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { balances: [{ currency: "COP", total: 100 }], topBudgets: [] })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.balances).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/summary");
  });

  it("useMonthlyTrend fetches the given months window", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { trend: [{ month: "2026-07", income: 0, expense: 0 }] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMonthlyTrend(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/trend?months=3");
  });

  it("useCategoryBreakdown fetches the given period", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { breakdown: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useCategoryBreakdown("2026-07"), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dashboard/category-breakdown?period=2026-07"
      )
    );
  });

  it("useRecentTransactions fetches with the given limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { transactions: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useRecentTransactions(5), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dashboard/recent-transactions?limit=5"
      )
    );
  });

  it("surfaces the API's error message on a failed query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: "Error interno del servidor" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Error interno del servidor");
  });
});
