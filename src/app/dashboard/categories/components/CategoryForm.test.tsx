import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryForm } from "@/app/dashboard/categories/components/CategoryForm";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/useCategories";
import { useCategoryModalStore } from "@/stores/categoryModal.store";

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
  useCreateCategory: vi.fn(),
  useUpdateCategory: vi.fn(),
}));

vi.mock("@/stores/categoryModal.store", () => ({
  useCategoryModalStore: vi.fn(),
}));

const existingCategory = {
  _id: "cat-1",
  userId: "u1",
  name: "Transporte",
  type: "expense" as const,
  isDefault: true,
  isArchived: false,
  createdAt: "",
  updatedAt: "",
};

interface StoreOverrides {
  isOpen?: boolean;
  editingCategoryId?: string | null;
  close?: ReturnType<typeof vi.fn>;
}

function mockStore(overrides: StoreOverrides) {
  const close = overrides.close ?? vi.fn();
  vi.mocked(useCategoryModalStore).mockImplementation(
    ((selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isOpen: overrides.isOpen ?? true,
        editingCategoryId: overrides.editingCategoryId ?? null,
        openCreate: vi.fn(),
        openEdit: vi.fn(),
        close,
      })) as never
  );
  return { close };
}

describe("CategoryForm", () => {
  let createMutateAsync: ReturnType<typeof vi.fn>;
  let updateMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutateAsync = vi.fn().mockResolvedValue({});
    updateMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreateCategory).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useUpdateCategory).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useCategories).mockReturnValue({
      data: [existingCategory],
    } as never);
  });

  it("renders the create form with the type select enabled", () => {
    mockStore({ isOpen: true, editingCategoryId: null });
    render(<CategoryForm />);

    expect(screen.getByText("Nueva categoría")).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo/i)).toBeEnabled();
  });

  it("creates a category and closes on success", async () => {
    const { close } = mockStore({ isOpen: true, editingCategoryId: null });
    const user = userEvent.setup();
    render(<CategoryForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Regalos");
    await user.selectOptions(screen.getByLabelText(/tipo/i), "income");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());
    expect(createMutateAsync).toHaveBeenCalledWith({
      name: "Regalos",
      type: "income",
    });
    expect(close).toHaveBeenCalled();
  });

  it("pre-fills the form in edit mode, disables type, and never sends it", async () => {
    const { close } = mockStore({
      isOpen: true,
      editingCategoryId: "cat-1",
    });
    const user = userEvent.setup();
    render(<CategoryForm />);

    expect(screen.getByText("Editar categoría")).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Transporte");
    expect(screen.getByLabelText(/tipo/i)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalled());
    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: "cat-1",
      input: { name: "Transporte" },
    });
    expect(close).toHaveBeenCalled();
  });

  it("shows a root error and does not close when the mutation fails", async () => {
    const { close } = mockStore({ isOpen: true, editingCategoryId: null });
    createMutateAsync.mockRejectedValueOnce(
      new Error("Ya existe esa categoría")
    );
    const user = userEvent.setup();
    render(<CategoryForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Transporte");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(
      await screen.findByText(/ya existe esa categoría/i)
    ).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
