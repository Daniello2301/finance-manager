import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyDashboardState } from "@/app/dashboard/components/EmptyDashboardState";

describe("EmptyDashboardState", () => {
  it("shows an inviting message instead of an error or blank charts", () => {
    render(<EmptyDashboardState />);
    expect(
      screen.getByText(/aún no has registrado transacciones/i)
    ).toBeInTheDocument();
  });

  it("links to the transactions page to create the first one", () => {
    render(<EmptyDashboardState />);
    expect(
      screen.getByRole("link", { name: /registrar mi primera transacción/i })
    ).toHaveAttribute("href", "/dashboard/transactions");
  });
});
