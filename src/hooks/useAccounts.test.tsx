import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { toastManager } from "@/lib/notifications";

// Spying on the real toast manager, rather than mocking `@/lib/notifications`,
// exercises the whole chain: hook `onError` → notifyErrorFrom → notifyError →
// the toast that actually reaches the viewport.
let addToast: ReturnType<typeof vi.spyOn>;

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

function createWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

describe("useAccounts hooks", () => {
  beforeEach(() => {
    addToast = vi.spyOn(toastManager, "add");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("useRecomputeBalance also invalidates the dashboard summary query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { account: { _id: "1", currentBalance: 120000 } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper, queryClient } = createWrapperWithClient();
    queryClient.setQueryData(["dashboard", "summary"], {
      balances: [],
      topBudgets: [],
    });

    const { result } = renderHook(() => useRecomputeBalance(), {
      wrapper: Wrapper,
    });

    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient.getQueryState(["dashboard", "summary"])?.isInvalidated
    ).toBe(true);
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

  // These mutations are fired from plain buttons, which have no field to show
  // an inline error in. Before the toasts, every one of them failed in silence
  // and the user was left believing the action had worked.
  describe("button-fired mutations report their outcome", () => {
    it("useArchiveAccount raises an error toast quoting the API's message", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(409, { error: "La cuenta tiene transacciones." })
        )
      );

      const { result } = renderHook(() => useArchiveAccount(), {
        wrapper: createWrapper(),
      });
      result.current.mutate("1");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "La cuenta tiene transacciones.",
          type: "error",
        })
      );
    });

    it("useArchiveAccount falls back to a generic message when the failure carries none", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("")));

      const { result } = renderHook(() => useArchiveAccount(), {
        wrapper: createWrapper(),
      });
      result.current.mutate("1");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudo archivar la cuenta.",
          type: "error",
        })
      );
    });

    // Recomputing is idempotent — a correct balance looks identical to an
    // untouched one — so success needs saying out loud or the button seems dead.
    it("useRecomputeBalance raises a success toast", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(200, { account: { _id: "1", currentBalance: 120000 } })
        )
      );

      const { result } = renderHook(() => useRecomputeBalance(), {
        wrapper: createWrapper(),
      });
      result.current.mutate("1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Saldo recalculado.", type: "success" })
      );
    });
  });
});
