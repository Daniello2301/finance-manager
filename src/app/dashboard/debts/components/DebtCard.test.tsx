import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebtCard } from "@/app/dashboard/debts/components/DebtCard";
import {
  useArchiveDebt,
  useUnarchiveDebt,
  type DebtWithState,
} from "@/hooks/useDebts";
import { useDebtModalStore } from "@/stores/debtModal.store";

vi.mock("@/hooks/useDebts", () => ({
  useArchiveDebt: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUnarchiveDebt: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/stores/debtModal.store", () => ({
  useDebtModalStore: vi.fn(),
}));

function entry(overrides: Partial<DebtWithState> = {}): DebtWithState {
  return {
    debt: {
      _id: "d1",
      userId: "u1",
      name: "Préstamo",
      principal: 17_000_000,
      monthlyRate: 0.015,
      isArchived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    state: {
      outstanding: 17_000_000,
      arrears: 0,
      totalPaid: 255_000,
      totalToInterest: 255_000,
      totalToPrincipal: 0,
      monthlyInterest: 255_000,
      underpaid: false,
      payments: [],
    },
    rate: { rate: 0.015, estimated: false },
    ...overrides,
  };
}

describe("DebtCard", () => {
  beforeEach(() => {
    vi.mocked(useDebtModalStore).mockImplementation(
      ((selector: (state: Record<string, unknown>) => unknown) =>
        selector({ openEdit: vi.fn(), openPayment: vi.fn() })) as never
    );
    vi.mocked(useArchiveDebt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useUnarchiveDebt).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it("shows the outstanding balance and this month's interest", () => {
    render(<DebtCard entry={entry()} />);
    expect(screen.getByText(/17\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/intereses de este mes/i)).toBeInTheDocument();
    // 255.000 legitimately appears more than once (this month's interest, the
    // interest paid to date, the total disbursed — they happen to coincide).
    expect(screen.getAllByText(/255\.000/).length).toBeGreaterThan(0);
  });

  // The most important assertion in this file. `outstanding: null` means "we
  // don't know"; rendering it as $0 would tell the user their debt is paid off.
  it("says it doesn't know, rather than showing zero, when there's no data", () => {
    const noData = entry({
      debt: { ...entry().debt, principal: undefined, monthlyRate: undefined },
      state: {
        outstanding: null,
        arrears: 0,
        totalPaid: 150_000,
        totalToInterest: 0,
        totalToPrincipal: 0,
        monthlyInterest: null,
        underpaid: false,
        payments: [],
      },
      rate: null,
    });

    render(<DebtCard entry={noData} />);

    expect(
      screen.getByText(/no hay datos suficientes para calcular el saldo/i)
    ).toBeInTheDocument();
    // Whatever it does, it must not claim the debt is at zero.
    expect(screen.queryByText(/^\$\s*0$/)).not.toBeInTheDocument();
    // What we do know, we still show.
    expect(screen.getByText(/150\.000/)).toBeInTheDocument();
  });

  it("warns when interest has gone uncovered", () => {
    const inArrears = entry({
      state: { ...entry().state, arrears: 45_000, underpaid: true },
    });
    render(<DebtCard entry={inArrears} />);

    expect(screen.getByText(/45\.000/)).toBeInTheDocument();
    expect(screen.getByText(/la deuda no baja/i)).toBeInTheDocument();
  });

  // A derived rate is not a fact from the user's contract, and must never be
  // shown as though it were.
  it("labels a derived rate as estimated", () => {
    render(
      <DebtCard entry={entry({ rate: { rate: 0.0151, estimated: true } })} />
    );
    expect(screen.getByText(/estimada/i)).toBeInTheDocument();
  });

  it("does not label a rate the user typed in", () => {
    render(<DebtCard entry={entry()} />);
    expect(screen.queryByText(/estimada/i)).not.toBeInTheDocument();
  });

  it("offers only the way back for an archived debt", () => {
    const archived = entry({ debt: { ...entry().debt, isArchived: true } });
    render(<DebtCard entry={archived} />);

    expect(
      screen.getByRole("button", { name: /desarchivar/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /registrar pago/i })
    ).not.toBeInTheDocument();
  });
});
