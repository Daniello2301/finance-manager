import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthSelector } from "@/components/MonthSelector";

describe("MonthSelector", () => {
  it("renders the formatted month and year", () => {
    render(<MonthSelector value="2026-07" onChange={vi.fn()} />);
    expect(screen.getByText("julio 2026")).toBeInTheDocument();
  });

  it("calls onChange with the previous month", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MonthSelector value="2026-07" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /mes anterior/i }));
    expect(onChange).toHaveBeenCalledWith("2026-06");
  });

  it("calls onChange with the next month", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MonthSelector value="2026-07" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /mes siguiente/i }));
    expect(onChange).toHaveBeenCalledWith("2026-08");
  });

  it("rolls over into the previous year from January", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MonthSelector value="2026-01" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /mes anterior/i }));
    expect(onChange).toHaveBeenCalledWith("2025-12");
  });

  it("rolls over into the next year from December", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MonthSelector value="2026-12" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /mes siguiente/i }));
    expect(onChange).toHaveBeenCalledWith("2027-01");
  });
});
