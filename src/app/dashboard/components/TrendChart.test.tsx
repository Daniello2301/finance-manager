import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { TrendChart } from "@/app/dashboard/components/TrendChart";
import { useMonthlyTrend } from "@/hooks/useDashboard";

vi.mock("@/hooks/useDashboard", () => ({
  useMonthlyTrend: vi.fn(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    children,
    data,
  }: {
    children: ReactNode;
    data: unknown[];
  }) => (
    <div data-testid="bar-chart" data-length={data.length}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`bar-${dataKey}`}>{name}</div>
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

function mockTrendResult(overrides: Record<string, unknown>) {
  vi.mocked(useMonthlyTrend).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("TrendChart", () => {
  it("shows a loading message", () => {
    mockTrendResult({ isLoading: true });
    render(<TrendChart />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("shows an error message", () => {
    mockTrendResult({ isError: true });
    render(<TrendChart />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it("renders the chart with income and expense bars", () => {
    mockTrendResult({
      data: [{ month: "2026-07", income: 500000, expense: 300000 }],
    });
    render(<TrendChart />);
    expect(screen.getByTestId("bar-chart")).toHaveAttribute(
      "data-length",
      "1"
    );
    expect(screen.getByTestId("bar-income")).toHaveTextContent("Ingresos");
    expect(screen.getByTestId("bar-expense")).toHaveTextContent("Gastos");
  });

  it("defaults to a 6-month range", () => {
    mockTrendResult({ data: [] });
    render(<TrendChart />);
    expect(useMonthlyTrend).toHaveBeenCalledWith(6);
  });

  it("switches the range when a different button is clicked", async () => {
    mockTrendResult({ data: [] });
    const user = userEvent.setup();
    render(<TrendChart />);

    await user.click(screen.getByRole("button", { name: "12m" }));
    expect(useMonthlyTrend).toHaveBeenLastCalledWith(12);
  });
});
