import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryList } from "@/app/dashboard/categories/components/CategoryList";
import { useArchiveCategory, useCategories } from "@/hooks/useCategories";

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
  useArchiveCategory: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUnarchiveCategory: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/stores/categoryModal.store", () => ({
  useCategoryModalStore: (
    selector: (state: { openEdit: () => void }) => unknown
  ) => selector({ openEdit: vi.fn() }),
}));

function mockQueryResult(overrides: Record<string, unknown>) {
  vi.mocked(useCategories).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("CategoryList", () => {
  it("defaults to the expense tab and shows a loading skeleton", () => {
    mockQueryResult({ isLoading: true });
    render(<CategoryList />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(useCategories).toHaveBeenCalledWith({ type: "expense", includeArchived: false });
  });

  it("shows an error message", () => {
    mockQueryResult({ isError: true });
    render(<CategoryList />);
    expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
  });

  it("shows an empty state for the active type", () => {
    mockQueryResult({ data: [] });
    render(<CategoryList />);
    expect(screen.getByText(/todavía no tienes categorías/i)).toBeInTheDocument();
  });

  it("renders a row per category", () => {
    mockQueryResult({
      data: [
        { _id: "1", name: "Transporte", type: "expense" },
        { _id: "2", name: "Vivienda", type: "expense" },
      ],
    });
    render(<CategoryList />);
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("Vivienda")).toBeInTheDocument();
  });

  it("switches to the income tab on click and re-queries with type=income", async () => {
    mockQueryResult({ data: [] });
    const user = userEvent.setup();
    render(<CategoryList />);

    await user.click(screen.getByRole("button", { name: /ingresos/i }));
    expect(useCategories).toHaveBeenCalledWith({ type: "income", includeArchived: false });
  });

  it("calls the archive mutation with the category id", async () => {
    const mutate = vi.fn();
    vi.mocked(useArchiveCategory).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
    mockQueryResult({
      data: [{ _id: "1", name: "Transporte", type: "expense" }],
    });
    const user = userEvent.setup();
    render(<CategoryList />);

    await user.click(screen.getByRole("button", { name: /archivar/i }));
    expect(mutate).toHaveBeenCalledWith("1");
  });
});
