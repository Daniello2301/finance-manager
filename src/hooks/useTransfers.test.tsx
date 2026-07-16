import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useTransfer } from "@/hooks/useTransfers";

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
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe("useTransfer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the transfer and returns the created legs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { transfer: { out: {}, in: {} } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTransfer(), { wrapper: Wrapper });

    result.current.mutate({
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      amount: 800_000,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transfers",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("invalidates accounts, transactions, categories and dashboard on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { transfer: { out: {}, in: {} } }));
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTransfer(), { wrapper: Wrapper });

    result.current.mutate({
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      amount: 800_000,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidate.mock.calls.map(
      (call) => (call[0] as { queryKey: string[] }).queryKey[0]
    );
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        "accounts",
        "transactions",
        "categories",
        "dashboard",
      ])
    );
  });

  it("surfaces the API's error on a failed transfer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { error: "Saldo insuficiente" }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTransfer(), { wrapper: Wrapper });

    result.current.mutate({
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      amount: 250_000,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
