import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/useCategories";

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

describe("useCategories hooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("useCategories fetches with no query params by default", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { categories: [{ _id: "1", name: "Salario" }] })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/categories");
  });

  it("useCategories({type:'income'}) adds the type query param", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { categories: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useCategories({ type: "income" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/categories?type=income")
    );
  });

  it("useCategories({includeArchived:true}) adds the includeArchived query param", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { categories: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useCategories({ includeArchived: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/categories?includeArchived=true"
      )
    );
  });

  it("useCreateCategory posts and invalidates the categories query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(201, { category: { _id: "1", name: "Nueva" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateCategory(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Nueva", type: "expense" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/categories",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("useUpdateCategory patches the given category id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { category: { _id: "1", name: "Editada" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "1", input: { name: "Editada" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/categories/1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("useArchiveCategory deletes (archives) the given category id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { category: { _id: "1", isArchived: true } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useArchiveCategory(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/categories/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("surfaces the API's error message on a failed mutation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(409, { error: "Ya existe una categoría con ese nombre" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateCategory(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Transporte", type: "expense" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Ya existe una categoría con ese nombre"
    );
  });
});
