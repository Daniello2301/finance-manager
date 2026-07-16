import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecurringForm } from "@/app/dashboard/recurring/components/RecurringForm";
import { useRecurringModalStore } from "@/stores/recurringModal.store";

const createMutate = vi.fn();
vi.mock("@/hooks/useRecurring", () => ({
  useRecurring: () => ({ data: [] }),
  useCreateRecurring: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateRecurring: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/AccountSelect", () => ({
  AccountSelect: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select data-testid={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      <option value="acc-1">Nu</option>
    </select>
  ),
}));

vi.mock("@/components/CategorySelect", () => ({
  CategorySelect: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select data-testid={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      <option value="cat-1">Suscripciones</option>
    </select>
  ),
}));

afterEach(() => {
  useRecurringModalStore.setState({ isOpen: false, editingRecurringId: null });
  vi.clearAllMocks();
});

function openForm() {
  useRecurringModalStore.setState({ isOpen: true, editingRecurringId: null });
  return render(<RecurringForm />);
}

describe("RecurringForm", () => {
  it("submits a new template in minor units with the chosen schedule", async () => {
    createMutate.mockResolvedValueOnce({ _id: "r1" });
    const user = userEvent.setup();
    openForm();

    await user.type(screen.getByLabelText(/nombre/i), "Netflix");
    await user.type(screen.getByLabelText(/monto/i), "44900");
    await user.selectOptions(screen.getByTestId("recurring-account"), "acc-1");
    await user.selectOptions(screen.getByTestId("recurring-category"), "cat-1");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Netflix",
        type: "expense",
        amount: 44900,
        accountId: "acc-1",
        categoryId: "cat-1",
        frequency: "monthly",
        autoGenerate: false,
      })
    );
  });

  it("switches to 'se cobra solo' when chosen", async () => {
    createMutate.mockResolvedValueOnce({ _id: "r1" });
    const user = userEvent.setup();
    openForm();

    await user.type(screen.getByLabelText(/nombre/i), "Spotify");
    await user.type(screen.getByLabelText(/monto/i), "16900");
    await user.selectOptions(screen.getByTestId("recurring-account"), "acc-1");
    await user.selectOptions(screen.getByTestId("recurring-category"), "cat-1");
    await user.click(screen.getByRole("button", { name: /se cobra solo/i }));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ autoGenerate: true })
    );
  });

  it("rejects a non-positive amount before calling the API", async () => {
    const user = userEvent.setup();
    openForm();

    await user.type(screen.getByLabelText(/nombre/i), "Malo");
    await user.type(screen.getByLabelText(/monto/i), "0");
    await user.selectOptions(screen.getByTestId("recurring-account"), "acc-1");
    await user.selectOptions(screen.getByTestId("recurring-category"), "cat-1");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/mayor que cero/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
