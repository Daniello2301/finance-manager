import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DebtForm } from "@/app/dashboard/debts/components/DebtForm";
import { useCreateDebt, useDebts, useUpdateDebt } from "@/hooks/useDebts";
import { useDebtModalStore } from "@/stores/debtModal.store";

vi.mock("@/hooks/useDebts", () => ({
  useDebts: vi.fn(),
  useCreateDebt: vi.fn(),
  useUpdateDebt: vi.fn(),
}));

vi.mock("@/stores/debtModal.store", () => ({
  useDebtModalStore: vi.fn(),
}));

const mutateAsync = vi.fn();

describe("DebtForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({});
    vi.mocked(useDebts).mockReturnValue({ data: [] } as never);
    vi.mocked(useCreateDebt).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useUpdateDebt).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useDebtModalStore).mockImplementation(
      ((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          isOpen: true,
          editingDebtId: null,
          close: vi.fn(),
        })) as never
    );
  });

  it("saves a debt that has nothing but a name", async () => {
    const user = userEvent.setup();
    render(<DebtForm />);

    await user.type(screen.getByLabelText(/nombre/i), "ADDI");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const input = mutateAsync.mock.calls[0][0];
    expect(input.name).toBe("ADDI");
    // Untouched optional fields must go as undefined, not as 0 — a principal of
    // 0 would make the app claim the debt is fully paid.
    expect(input.principal).toBeUndefined();
    expect(input.monthlyRate).toBeUndefined();
  });

  it("does not save without a name", async () => {
    const user = userEvent.setup();
    render(<DebtForm />);

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/el nombre es obligatorio/i)
    ).toBeInTheDocument();
  });

  /**
   * The single highest-probability bug in this module, flagged as such in the
   * plan: the user types a PERCENTAGE ("1.5") and everything below the form
   * works in DECIMAL FRACTIONS ("0.015"). Getting this backwards is a hundred-fold
   * error in someone's real debt.
   */
  it("converts the typed percentage into a decimal fraction exactly once", async () => {
    const user = userEvent.setup();
    render(<DebtForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Préstamo");
    await user.type(screen.getByLabelText(/monto original/i), "17000000");
    await user.type(screen.getByLabelText(/tasa de interés/i), "1.5");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const input = mutateAsync.mock.calls[0][0];

    // 1.5% a month → 0.015. NOT 1.5, and NOT 0.00015.
    expect(input.monthlyRate).toBeCloseTo(0.015, 6);
    expect(input.principal).toBe(17_000_000);
  });

  // US6: the owner knows the instalment and the term of their bank loan, but not
  // the rate. The form solves it in front of them, and says it's an estimate.
  it("shows the solved rate, marked as estimated, once the three figures are in", async () => {
    const user = userEvent.setup();
    render(<DebtForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Banco");
    await user.type(screen.getByLabelText(/monto original/i), "10000000");
    await user.type(screen.getByLabelText(/valor de la cuota/i), "500000");
    await user.type(screen.getByLabelText(/número de cuotas/i), "24");

    expect(await screen.findByText(/estimada/i)).toBeInTheDocument();
    // ~1.51% a month for that loan.
    expect(screen.getByText(/1\.5\d% mensual/)).toBeInTheDocument();
  });

  it("does not solve for a rate the user already gave", async () => {
    const user = userEvent.setup();
    render(<DebtForm />);

    await user.type(screen.getByLabelText(/nombre/i), "Banco");
    await user.type(screen.getByLabelText(/monto original/i), "10000000");
    await user.type(screen.getByLabelText(/valor de la cuota/i), "500000");
    await user.type(screen.getByLabelText(/número de cuotas/i), "24");
    await user.type(screen.getByLabelText(/tasa de interés/i), "2");

    await waitFor(() =>
      expect(screen.queryByText(/estimada/i)).not.toBeInTheDocument()
    );
  });
});
