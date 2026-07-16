import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { UpcomingRecurringWidget } from "@/app/dashboard/components/UpcomingRecurringWidget";

const catchUpMutate = vi.fn();
const useRecurring = vi.fn();

vi.mock("@/hooks/useRecurring", () => ({
  useRecurring: () => useRecurring(),
  useCatchUp: () => ({ mutate: catchUpMutate }),
}));

/** Days from now, as the ISO string the API would return. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function template(overrides: Record<string, unknown> = {}) {
  return {
    _id: "r1",
    name: "Netflix",
    type: "expense",
    amount: 44_900,
    frequency: "monthly",
    nextDueDate: inDays(3),
    isPaused: false,
    isArchived: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("UpcomingRecurringWidget", () => {
  // This is what keeps automatic charges materialised — and it must not re-fire
  // on every render, which is what the useRef guard is for.
  it("fires the catch-up sweep exactly once on mount", () => {
    useRecurring.mockReturnValue({ data: [] });
    const { rerender } = render(<UpcomingRecurringWidget />);
    rerender(<UpcomingRecurringWidget />);

    expect(catchUpMutate).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when nothing is due soon, but still sweeps", () => {
    useRecurring.mockReturnValue({ data: [] });
    const { container } = render(<UpcomingRecurringWidget />);

    expect(container).toBeEmptyDOMElement();
    expect(catchUpMutate).toHaveBeenCalledTimes(1);
  });

  it("lists what's coming and totals only the committed spending", () => {
    useRecurring.mockReturnValue({
      data: [
        template({ _id: "r1", name: "Netflix", amount: 44_900 }),
        template({ _id: "r2", name: "Arriendo", amount: 1_500_000, nextDueDate: inDays(10) }),
        // Income is listed but must NOT count towards "comprometidos".
        template({ _id: "r3", name: "Sueldo", type: "income", amount: 5_000_000 }),
      ],
    });
    render(<UpcomingRecurringWidget />);

    expect(screen.getByText(/Netflix/)).toBeInTheDocument();
    expect(screen.getByText(/Arriendo/)).toBeInTheDocument();
    expect(screen.getByText(/Sueldo/)).toBeInTheDocument();
    // 44.900 + 1.500.000 — the salary is excluded.
    expect(screen.getByText(/1\.544\.900 comprometidos/)).toBeInTheDocument();
  });

  it("ignores paused, archived and anything beyond the horizon", () => {
    useRecurring.mockReturnValue({
      data: [
        template({ _id: "r1", name: "Pausado", isPaused: true }),
        template({ _id: "r2", name: "Archivado", isArchived: true }),
        template({ _id: "r3", name: "Lejano", nextDueDate: inDays(90) }),
      ],
    });
    const { container } = render(<UpcomingRecurringWidget />);

    expect(container).toBeEmptyDOMElement();
  });

  it("orders the upcoming ones by due date", () => {
    useRecurring.mockReturnValue({
      data: [
        template({ _id: "r1", name: "Tarde", nextDueDate: inDays(20) }),
        template({ _id: "r2", name: "Pronto", nextDueDate: inDays(1) }),
      ],
    });
    render(<UpcomingRecurringWidget />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Pronto");
    expect(items[1]).toHaveTextContent("Tarde");
  });
});
