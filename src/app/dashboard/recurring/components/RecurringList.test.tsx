import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecurringList } from "@/app/dashboard/recurring/components/RecurringList";

const useRecurring = vi.fn();
vi.mock("@/hooks/useRecurring", () => ({
  useRecurring: (includeArchived: boolean) => useRecurring(includeArchived),
}));

// The card has its own test; here we only care that the list renders one per item.
vi.mock("@/app/dashboard/recurring/components/RecurringCard", () => ({
  RecurringCard: ({ recurring }: { recurring: { name: string } }) => (
    <div data-testid="recurring-card">{recurring.name}</div>
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("RecurringList", () => {
  it("shows a skeleton while loading", () => {
    useRecurring.mockReturnValue({ isLoading: true });
    const { container } = render(<RecurringList />);
    // The skeleton renders placeholders, not the empty-state copy.
    expect(screen.queryByText(/No tienes recurrentes/)).not.toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it("reports a load failure", () => {
    useRecurring.mockReturnValue({ isLoading: false, isError: true });
    render(<RecurringList />);
    expect(screen.getByText(/No se pudieron cargar/)).toBeInTheDocument();
  });

  it("explains the empty state", () => {
    useRecurring.mockReturnValue({ isLoading: false, isError: false, data: [] });
    render(<RecurringList />);
    expect(screen.getByText(/No tienes recurrentes\./)).toBeInTheDocument();
  });

  it("renders one card per template", () => {
    useRecurring.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ _id: "r1", name: "Netflix" }, { _id: "r2", name: "Arriendo" }],
    });
    render(<RecurringList />);
    expect(screen.getAllByTestId("recurring-card")).toHaveLength(2);
  });

  it("the toggle asks the hook for archived templates", async () => {
    useRecurring.mockReturnValue({ isLoading: false, isError: false, data: [] });
    const user = userEvent.setup();
    render(<RecurringList />);

    expect(useRecurring).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: /ver archivados/i }));

    expect(useRecurring).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByText(/No tienes recurrentes archivados/)
    ).toBeInTheDocument();
  });
});
