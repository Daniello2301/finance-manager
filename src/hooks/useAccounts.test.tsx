import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useAccounts,
  useArchiveAccount,
  useCreateAccount,
  useRecomputeBalance,
  useUpdateAccount,
} from "@/hooks/useAccounts";

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

describe("useAccounts hooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useAccounts fetches the default (active-only) list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { accounts: [{ _id: "1", name: "Ahorros" }] })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/accounts");
  });

  it("useAccounts(true) includes archived accounts in the query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { accounts: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useAccounts(true), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/accounts?includeArchived=true"
      )
    );
  });

  it("useCreateAccount posts and invalidates the accounts query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(201, { account: { _id: "1", name: "Nueva" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "Nueva",
      type: "cash",
      currency: "COP",
      initialBalance: 0,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/accounts",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("useUpdateAccount patches the given account id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { account: { _id: "1", name: "Editada" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpdateAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "1", input: { name: "Editada" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/accounts/1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("useArchiveAccount deletes (archives) the given account id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { account: { _id: "1", isArchived: true } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useArchiveAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/accounts/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("useRecomputeBalance posts to the recompute-balance sub-route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { account: { _id: "1", currentBalance: 120000 } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecomputeBalance(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/accounts/1/recompute-balance",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("surfaces the API's error message on a failed mutation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { error: "Datos inválidos" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "",
      type: "cash",
      currency: "COP",
      initialBalance: 0,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Datos inválidos");
  });
});
