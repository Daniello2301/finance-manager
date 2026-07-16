import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useArchiveRecurring,
  useCatchUp,
  useConfirmOccurrence,
  useCreateRecurring,
  usePauseRecurring,
  useRecurring,
  useRecurringItem,
  useSkipOccurrence,
  useUnarchiveRecurring,
  useUpdateRecurring,
} from "@/hooks/useRecurring";

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
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

describe("useRecurring hooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("useRecurring fetches the active list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: [{ _id: "r1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecurring(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/recurring");
  });

  it("useRecurring asks for archived ones when requested", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    renderHook(() => useRecurring(true), { wrapper: Wrapper });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/recurring?includeArchived=true")
    );
  });

  it("useRecurringItem fetches one template by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecurringItem("r1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/recurring/r1");
  });

  it("useRecurringItem does not fetch when the id is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    renderHook(() => useRecurringItem(null), { wrapper: Wrapper });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("useUpdateRecurring patches the given id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateRecurring(), { wrapper: Wrapper });

    result.current.mutate({ id: "r1", input: { amount: 49900 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recurring/r1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("usePauseRecurring patches isPaused", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePauseRecurring(), { wrapper: Wrapper });

    result.current.mutate({ id: "r1", isPaused: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recurring/r1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isPaused: true }),
      })
    );
  });

  it("useArchiveRecurring deletes (which archives server-side)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRecurring(), { wrapper: Wrapper });

    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/recurring/r1", {
      method: "DELETE",
    });
  });

  it("useUnarchiveRecurring patches isArchived back to false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUnarchiveRecurring(), {
      wrapper: Wrapper,
    });

    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recurring/r1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isArchived: false }),
      })
    );
  });

  it("useCreateRecurring posts and invalidates recurring + dashboard", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useCreateRecurring(), { wrapper: Wrapper });

    result.current.mutate({
      name: "Netflix",
      type: "expense",
      amount: 44900,
      accountId: "a1",
      categoryId: "c1",
      frequency: "monthly",
      startDate: new Date("2026-07-20"),
      autoGenerate: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recurring",
      expect.objectContaining({ method: "POST" })
    );
    const keys = invalidate.mock.calls.map(
      (c) => (c[0] as { queryKey: string[] }).queryKey[0]
    );
    expect(keys).toEqual(expect.arrayContaining(["recurring", "dashboard"]));
  });

  it("useConfirmOccurrence posts to the confirm endpoint and busts money caches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useConfirmOccurrence(), { wrapper: Wrapper });

    result.current.mutate({ id: "r1", occurrenceKey: "2026-07-10", amount: 214300 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recurring/r1/confirm",
      expect.objectContaining({ method: "POST" })
    );
    const keys = invalidate.mock.calls.map(
      (c) => (c[0] as { queryKey: string[] }).queryKey[0]
    );
    expect(keys).toEqual(
      expect.arrayContaining(["recurring", "transactions", "accounts", "dashboard"])
    );
  });

  it("useSkipOccurrence posts to the skip endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { recurring: { _id: "r1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSkipOccurrence(), { wrapper: Wrapper });

    result.current.mutate({ id: "r1", occurrenceKey: "2026-07-10" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recurring/r1/skip",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("useCatchUp busts the money caches when it generated something", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { created: 2, pending: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useCatchUp(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/recurring/catch-up", {
      method: "POST",
    });
    const keys = invalidate.mock.calls.map(
      (c) => (c[0] as { queryKey: string[] }).queryKey[0]
    );
    expect(keys).toEqual(
      expect.arrayContaining(["transactions", "accounts", "dashboard", "recurring"])
    );
  });

  it("useCatchUp only busts money caches when something was created", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { created: 0, pending: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { Wrapper, invalidate } = createWrapper();
    const { result } = renderHook(() => useCatchUp(), { wrapper: Wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidate.mock.calls.map(
      (c) => (c[0] as { queryKey: string[] }).queryKey[0]
    );
    // Nothing created → recurring refreshed, but transactions/accounts untouched.
    expect(keys).toContain("recurring");
    expect(keys).not.toContain("transactions");
  });
});
