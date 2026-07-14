import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { OverdrawnAlert } from "@/app/dashboard/components/OverdrawnAlert";
import { useAccounts } from "@/hooks/useAccounts";

vi.mock("@/hooks/useAccounts", () => ({ useAccounts: vi.fn() }));

function account(overrides: Record<string, unknown>) {
  return {
    _id: "a1",
    name: "Ahorros",
    type: "bank",
    currency: "COP",
    currentBalance: 100_000,
    isArchived: false,
    ...overrides,
  };
}

function mockAccounts(accounts: unknown[]) {
  vi.mocked(useAccounts).mockReturnValue({ data: accounts } as never);
}

describe("OverdrawnAlert", () => {
  beforeEach(() => {
    mockAccounts([]);
  });

  it("renders nothing when every account is in the black", () => {
    mockAccounts([account({ currentBalance: 100_000 })]);
    const { container } = render(<OverdrawnAlert />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names the overdrawn account and how deep it is", () => {
    mockAccounts([account({ name: "Nu", currentBalance: -244_900 })]);
    render(<OverdrawnAlert />);

    expect(screen.getByText(/una cuenta está en descubierto/i)).toBeInTheDocument();
    expect(screen.getByText("Nu")).toBeInTheDocument();
    expect(screen.getByText(/244\.900/)).toBeInTheDocument();
    // The question the whole module exists to ask.
    expect(screen.getByText(/salió de algún sitio/i)).toBeInTheDocument();
  });

  // Spending money you don't have is what a card is FOR. Flagging it would cry
  // wolf on every card the user actually uses, and then the real alert — a bank
  // account in the red — would be noise they've learned to scroll past.
  it("does NOT flag a credit card that is inside its limit", () => {
    mockAccounts([
      account({
        name: "Visa",
        type: "credit_card",
        currentBalance: -500_000,
        creditLimit: 2_000_000,
      }),
    ]);
    const { container } = render(<OverdrawnAlert />);

    expect(container).toBeEmptyDOMElement();
  });

  it("DOES flag a credit card that has blown past its limit", () => {
    mockAccounts([
      account({
        name: "Visa",
        type: "credit_card",
        currentBalance: -2_100_000,
        creditLimit: 2_000_000,
      }),
    ]);
    render(<OverdrawnAlert />);

    expect(screen.getByText("Visa")).toBeInTheDocument();
  });

  it("counts them when more than one account is overdrawn", () => {
    mockAccounts([
      account({ _id: "a1", name: "Nu", currentBalance: -10_000 }),
      account({ _id: "a2", name: "Efectivo", currentBalance: -5_000 }),
    ]);
    render(<OverdrawnAlert />);

    expect(
      screen.getByText(/2 cuentas están en descubierto/i)
    ).toBeInTheDocument();
  });

  // Putting an account away does not settle what it owes.
  it("asks for archived accounts too", () => {
    render(<OverdrawnAlert />);
    expect(useAccounts).toHaveBeenCalledWith(true);
  });
});
