import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useBudgets,
  useCopyBudgets,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from "@/hooks/useBudgets";

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

describe("useBudgets hooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useBudgets fetches the given period", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { budgets: [{ _id: "1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBudgets("2026-07"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/budgets?period=2026-07");
  });

  it("useCreateBudget posts and invalidates the budgets query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { budget: { _id: "1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateBudget(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      categoryId: "cat-1",
      periodKey: "2026-07",
      limitAmount: 600000,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("useUpdateBudget patches the given budget id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { budget: { _id: "1", limitAmount: 700000 } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpdateBudget(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "1", input: { limitAmount: 700000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("useDeleteBudget deletes the given budget id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDeleteBudget(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("useCopyBudgets posts fromPeriod/toPeriod", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { budgets: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCopyBudgets(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ fromPeriod: "2026-06", toPeriod: "2026-07" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/copy",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("surfaces the API's error message on a failed mutation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { error: "Datos inválidos" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateBudget(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      categoryId: "cat-1",
      periodKey: "2026-07",
      limitAmount: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Datos inválidos");
  });
});
