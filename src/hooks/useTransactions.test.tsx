import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransaction,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/useTransactions";

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

describe("useTransactions hooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useTransactions fetches the unfiltered list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [{ _id: "1" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTransactions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions");
  });

  it("useTransactions builds a query string from the given filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [],
        pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(
      () =>
        useTransactions({
          accountId: "acc-1",
          type: "expense",
          page: 2,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/transactions?accountId=acc-1&type=expense&page=2"
      )
    );
  });

  it("useTransaction fetches a single transaction by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { transaction: { _id: "tx-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTransaction("tx-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/tx-1");
  });

  it("useTransaction does not fetch when id is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useTransaction(null), { wrapper: createWrapper() });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("useCreateTransaction posts and invalidates transactions and accounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(201, { transaction: { _id: "tx-1" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateTransaction(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      accountId: "acc-1",
      categoryId: "cat-1",
      type: "expense",
      amount: 50000,
      date: new Date("2026-07-01"),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("useUpdateTransaction patches the given transaction id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { transaction: { _id: "tx-1", amount: 60000 } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpdateTransaction(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "tx-1", input: { amount: 60000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions/tx-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("useDeleteTransaction deletes the given transaction id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDeleteTransaction(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("tx-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions/tx-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("surfaces the API's error message on a failed mutation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { error: "Datos inválidos" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateTransaction(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      accountId: "acc-1",
      categoryId: "cat-1",
      type: "expense",
      amount: 0,
      date: new Date("2026-07-01"),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Datos inválidos");
  });
});
