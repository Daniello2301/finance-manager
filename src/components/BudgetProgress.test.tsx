import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetProgress } from "@/components/BudgetProgress";

describe("BudgetProgress", () => {
  it("shows the spent/limit amounts and percentage", () => {
    render(
      <BudgetProgress
        spentAmount={450000}
        limitAmount={600000}
        currency="COP"
        percentUsed={75}
      />
    );
    expect(screen.getByText(/450\.000/)).toBeInTheDocument();
    expect(screen.getByText(/600\.000/)).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it("colors the bar green under 80%", () => {
    render(
      <BudgetProgress
        spentAmount={100000}
        limitAmount={600000}
        currency="COP"
        percentUsed={16}
      />
    );
    const bar = screen.getByRole("progressbar").firstElementChild;
    expect(bar).toHaveClass("bg-positive");
  });

  it("colors the bar amber between 80% and 100%", () => {
    render(
      <BudgetProgress
        spentAmount={500000}
        limitAmount={600000}
        currency="COP"
        percentUsed={83}
      />
    );
    const bar = screen.getByRole("progressbar").firstElementChild;
    expect(bar).toHaveClass("bg-amber-500");
  });

  it("colors the bar red at or above 100%", () => {
    render(
      <BudgetProgress
        spentAmount={700000}
        limitAmount={600000}
        currency="COP"
        percentUsed={117}
      />
    );
    const bar = screen.getByRole("progressbar").firstElementChild;
    expect(bar).toHaveClass("bg-negative");
  });

  it("caps the visible bar width at 100% even when overspent", () => {
    render(
      <BudgetProgress
        spentAmount={900000}
        limitAmount={600000}
        currency="COP"
        percentUsed={150}
      />
    );
    const bar = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });
});
