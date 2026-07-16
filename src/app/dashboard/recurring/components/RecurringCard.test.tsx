import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecurringCard } from "@/app/dashboard/recurring/components/RecurringCard";
import { useRecurringModalStore } from "@/stores/recurringModal.store";
import type { Recurring } from "@/hooks/useRecurring";

const pauseMutate = vi.fn();
const archiveMutate = vi.fn();
const unarchiveMutate = vi.fn();

vi.mock("@/hooks/useRecurring", () => ({
  usePauseRecurring: () => ({ mutate: pauseMutate, isPending: false }),
  useArchiveRecurring: () => ({ mutate: archiveMutate, isPending: false }),
  useUnarchiveRecurring: () => ({ mutate: unarchiveMutate, isPending: false }),
}));

const confirmAction = vi.fn();
vi.mock("@/lib/notifications", () => ({
  confirmAction: (options: unknown) => confirmAction(options),
}));

const base: Recurring = {
  _id: "r1",
  userId: "u1",
  name: "Netflix",
  type: "expense",
  amount: 44_900,
  accountId: "acc-1",
  categoryId: "cat-1",
  frequency: "monthly",
  anchorDay: 20,
  startDate: "2026-07-20",
  nextDueDate: "2026-08-20T00:00:00.000Z",
  autoGenerate: true,
  isPaused: false,
  isArchived: false,
  createdAt: "",
  updatedAt: "",
};

afterEach(() => {
  useRecurringModalStore.setState({ isOpen: false, editingRecurringId: null });
  vi.clearAllMocks();
});

describe("RecurringCard", () => {
  it("shows the amount, cadence, how it's charged and the next due date", () => {
    render(<RecurringCard recurring={base} />);

    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText(/44\.900/)).toBeInTheDocument();
    expect(screen.getByText(/Mensual/)).toBeInTheDocument();
    expect(screen.getByText(/Se cobra solo/)).toBeInTheDocument();
    expect(screen.getByText(/20 de agosto de 2026/)).toBeInTheDocument();
  });

  it("marks an income and says when the user pays it themselves", () => {
    render(
      <RecurringCard
        recurring={{ ...base, type: "income", autoGenerate: false }}
      />
    );

    expect(screen.getByText(/\+\$/)).toBeInTheDocument();
    expect(screen.getByText(/Lo pagas tú/)).toBeInTheDocument();
  });

  it("opens the edit modal", async () => {
    const user = userEvent.setup();
    render(<RecurringCard recurring={base} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    const state = useRecurringModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.editingRecurringId).toBe("r1");
  });

  it("pauses an active template", async () => {
    const user = userEvent.setup();
    render(<RecurringCard recurring={base} />);

    await user.click(screen.getByRole("button", { name: /pausar/i }));

    expect(pauseMutate).toHaveBeenCalledWith({ id: "r1", isPaused: true });
  });

  it("shows a paused template as such and offers to resume it", async () => {
    const user = userEvent.setup();
    render(<RecurringCard recurring={{ ...base, isPaused: true }} />);

    expect(screen.getByText("En pausa")).toBeInTheDocument();
    // A paused template has no next due date to promise.
    expect(screen.queryByText(/Próximo:/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reanudar/i }));
    expect(pauseMutate).toHaveBeenCalledWith({ id: "r1", isPaused: false });
  });

  it("archives only after the user confirms", async () => {
    confirmAction.mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<RecurringCard recurring={base} />);

    await user.click(screen.getByRole("button", { name: /archivar/i }));

    await waitFor(() => expect(archiveMutate).toHaveBeenCalledWith("r1"));
  });

  it("does not archive when the user backs out", async () => {
    confirmAction.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<RecurringCard recurring={base} />);

    await user.click(screen.getByRole("button", { name: /archivar/i }));

    await waitFor(() => expect(confirmAction).toHaveBeenCalled());
    expect(archiveMutate).not.toHaveBeenCalled();
  });

  it("an archived template offers only to unarchive", async () => {
    const user = userEvent.setup();
    render(<RecurringCard recurring={{ ...base, isArchived: true }} />);

    expect(screen.getByText("Archivado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /desarchivar/i }));
    expect(unarchiveMutate).toHaveBeenCalledWith("r1");
  });
});
