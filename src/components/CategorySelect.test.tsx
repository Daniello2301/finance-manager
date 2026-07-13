import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategorySelect } from "@/components/CategorySelect";
import { useCategories } from "@/hooks/useCategories";

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

const categories = [
  { _id: "1", name: "Salario", type: "income" },
  { _id: "2", name: "Transporte", type: "expense" },
  { _id: "3", name: "Vivienda", type: "expense" },
];

describe("CategorySelect", () => {
  it("groups categories into Ingresos/Gastos optgroups when no type filter is given", () => {
    vi.mocked(useCategories).mockReturnValue({
      data: categories,
      isLoading: false,
    } as never);

    render(<CategorySelect onChange={vi.fn()} />);

    expect(
      screen.getByRole("group", { name: "Ingresos" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Gastos" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Salario" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Transporte" })
    ).toBeInTheDocument();
  });

  it("renders a flat list with no optgroups when a type filter is given", () => {
    vi.mocked(useCategories).mockReturnValue({
      data: [categories[1], categories[2]],
      isLoading: false,
    } as never);

    render(<CategorySelect type="expense" onChange={vi.fn()} />);

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Transporte" })
    ).toBeInTheDocument();
  });

  it("calls onChange with the selected category id", async () => {
    vi.mocked(useCategories).mockReturnValue({
      data: categories,
      isLoading: false,
    } as never);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<CategorySelect onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "2");

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("shows a loading placeholder while categories are being fetched", () => {
    vi.mocked(useCategories).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);

    render(<CategorySelect onChange={vi.fn()} />);
    expect(screen.getByText(/cargando categorías/i)).toBeInTheDocument();
  });
});
