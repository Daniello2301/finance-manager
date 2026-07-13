import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { CategoryBreakdownChart } from "@/app/dashboard/components/CategoryBreakdownChart";
import { useCategoryBreakdown } from "@/hooks/useDashboard";

vi.mock("@/hooks/useDashboard", () => ({
  useCategoryBreakdown: vi.fn(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({
    data,
    children,
  }: {
    data: { categoryName: string }[];
    children: ReactNode;
  }) => (
    <div data-testid="pie" data-length={data.length}>
      {data.map((entry) => (
        <span key={entry.categoryName}>{entry.categoryName}</span>
      ))}
      {children}
    </div>
  ),
  Cell: () => null,
  Legend: () => null,
  Tooltip: () => null,
}));

function mockBreakdownResult(overrides: Record<string, unknown>) {
  vi.mocked(useCategoryBreakdown).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("CategoryBreakdownChart", () => {
  it("shows a loading message", () => {
    mockBreakdownResult({ isLoading: true });
    render(<CategoryBreakdownChart />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("shows an error message", () => {
    mockBreakdownResult({ isError: true });
    render(<CategoryBreakdownChart />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it("shows an empty state when there is no spend this month", () => {
    mockBreakdownResult({ data: [] });
    render(<CategoryBreakdownChart />);
    expect(
      screen.getByText(/aún no registras gastos este mes/i)
    ).toBeInTheDocument();
  });

  it("renders the pie chart with one slice per category", () => {
    mockBreakdownResult({
      data: [
        { categoryId: "1", categoryName: "Mercado", total: 300000 },
        { categoryId: "2", categoryName: "Transporte", total: 200000 },
      ],
    });
    render(<CategoryBreakdownChart />);
    expect(screen.getByTestId("pie")).toHaveAttribute("data-length", "2");
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });
});
