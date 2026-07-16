import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CardStatement } from "@/app/dashboard/accounts/components/CardStatement";
import { useStatement, type Account } from "@/hooks/useAccounts";
import { useTransferModalStore } from "@/stores/transferModal.store";

vi.mock("@/hooks/useAccounts", () => ({ useStatement: vi.fn() }));

const card: Account = {
  _id: "c1",
  userId: "u1",
  name: "Visa",
  type: "credit_card",
  currency: "COP",
  initialBalance: 0,
  currentBalance: -2_700_000,
  creditLimit: 5_000_000,
  statementDay: 20,
  paymentDay: 5,
  isArchived: false,
  createdAt: "",
  updatedAt: "",
};

function mockStatement(data: unknown) {
  vi.mocked(useStatement).mockReturnValue({ data, isLoading: false } as never);
}

afterEach(() => {
  useTransferModalStore.setState({
    isOpen: false,
    toAccountId: undefined,
    amount: undefined,
  });
  vi.restoreAllMocks();
});

describe("CardStatement", () => {
  it("renders nothing for an account that isn't a card", () => {
    mockStatement(undefined);
    const { container } = render(
      <CardStatement account={{ ...card, type: "bank" }} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  // A payment deadline guessed wrong is worse than no deadline at all.
  it("does not invent a cycle when the card has no dates", () => {
    mockStatement(undefined);
    render(
      <CardStatement
        account={{ ...card, statementDay: undefined, paymentDay: undefined }}
      />
    );

    expect(screen.getByText(/añade el día de corte/i)).toBeInTheDocument();
    expect(screen.queryByText(/a pagar antes del/i)).not.toBeInTheDocument();
  });

  // The whole point of the module: the card OWES 2.700.000 but this statement
  // only DEMANDS 500.000 (a normal purchase plus one instalment). Showing either
  // as the other is the error this exists to avoid.
  it("shows what must be paid, which is not what is owed", () => {
    mockStatement({
      currentBalance: -2_700_000,
      amountDue: 500_000,
      close: "2026-07-20",
      due: "2026-08-05",
      nextClose: "2026-08-20",
      nextDue: "2026-09-05",
      currency: "COP",
    });
    render(<CardStatement account={card} />);

    expect(screen.getByText(/500\.000/)).toBeInTheDocument();
    expect(screen.getByText(/5 de agosto/i)).toBeInTheDocument();
    // And it answers the question people actually ask a credit card.
    expect(screen.getByText(/compres hoy se paga el 5 de septiembre/i)).toBeInTheDocument();
  });

  it("the pay button opens a transfer prefilled with what is due", async () => {
    const user = userEvent.setup();
    mockStatement({
      currentBalance: -2_700_000,
      amountDue: 500_000,
      close: "2026-07-20",
      due: "2026-08-05",
      nextClose: "2026-08-20",
      nextDue: "2026-09-05",
      currency: "COP",
    });
    render(<CardStatement account={card} />);

    await user.click(screen.getByRole("button", { name: /pagar tarjeta/i }));

    const state = useTransferModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.toAccountId).toBe("c1");
    expect(state.amount).toBe(500_000);
  });

  it("offers no payment when the statement demands nothing", () => {
    mockStatement({
      currentBalance: 0,
      amountDue: 0,
      close: "2026-07-20",
      due: "2026-08-05",
      nextClose: "2026-08-20",
      nextDue: "2026-09-05",
      currency: "COP",
    });
    render(<CardStatement account={card} />);

    expect(
      screen.queryByRole("button", { name: /pagar tarjeta/i })
    ).not.toBeInTheDocument();
  });
});
