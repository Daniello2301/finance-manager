import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PendingConfirmations } from "@/app/dashboard/recurring/components/PendingConfirmations";

const confirmMutate = vi.fn();
const skipMutate = vi.fn();

const template = {
  _id: "r1",
  userId: "u1",
  name: "Energía",
  type: "expense" as const,
  amount: 180_000,
  accountId: "acc-1",
  categoryId: "cat-1",
  frequency: "monthly" as const,
  anchorDay: 10,
  startDate: "2026-01-10",
  nextDueDate: "2026-01-10T00:00:00.000Z", // overdue relative to today
  autoGenerate: false,
  isPaused: false,
  isArchived: false,
  createdAt: "",
  updatedAt: "",
};

const recurringData = { current: [template] as unknown[] };
vi.mock("@/hooks/useRecurring", () => ({
  useRecurring: () => ({ data: recurringData.current }),
  useConfirmOccurrence: () => ({ mutateAsync: confirmMutate, isPending: false }),
  useSkipOccurrence: () => ({ mutate: skipMutate, isPending: false }),
}));

vi.mock("@/components/InsufficientFundsDialog", () => ({
  InsufficientFundsDialog: () => null,
}));

afterEach(() => {
  vi.clearAllMocks();
  recurringData.current = [template];
});

describe("PendingConfirmations", () => {
  it("renders nothing when there are no pending manual occurrences", () => {
    recurringData.current = [];
    const { container } = render(<PendingConfirmations />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists an overdue manual template and confirms its earliest occurrence", async () => {
    confirmMutate.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<PendingConfirmations />);

    expect(screen.getByText("Energía")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(confirmMutate).toHaveBeenCalledTimes(1));
    expect(confirmMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", occurrenceKey: "2026-01-10" })
    );
  });

  it("skips the earliest occurrence", async () => {
    const user = userEvent.setup();
    render(<PendingConfirmations />);

    await user.click(screen.getByRole("button", { name: /saltar/i }));

    expect(skipMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", occurrenceKey: "2026-01-10" })
    );
  });
});
