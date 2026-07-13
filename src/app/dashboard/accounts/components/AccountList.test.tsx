import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountList } from "@/app/dashboard/accounts/components/AccountList";
import { useAccounts } from "@/hooks/useAccounts";

vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
  useArchiveAccount: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRecomputeBalance: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/stores/accountModal.store", () => ({
  useAccountModalStore: (
    selector: (state: { openEdit: () => void }) => unknown
  ) => selector({ openEdit: vi.fn() }),
}));

function mockQueryResult(overrides: Record<string, unknown>) {
  vi.mocked(useAccounts).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as never);
}

describe("AccountList", () => {
  it("shows a loading message", () => {
    mockQueryResult({ isLoading: true });
    render(<AccountList />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("shows an error message", () => {
    mockQueryResult({ isError: true });
    render(<AccountList />);
    expect(screen.getByText(/no se pudieron cargar/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no accounts", () => {
    mockQueryResult({ data: [] });
    render(<AccountList />);
    expect(
      screen.getByText(/todavía no tienes cuentas/i)
    ).toBeInTheDocument();
  });

  it("renders a card per account", () => {
    mockQueryResult({
      data: [
        {
          _id: "1",
          userId: "u1",
          name: "Ahorros",
          type: "bank",
          currency: "COP",
          initialBalance: 0,
          currentBalance: 0,
          isArchived: false,
          createdAt: "",
          updatedAt: "",
        },
        {
          _id: "2",
          userId: "u1",
          name: "Efectivo",
          type: "cash",
          currency: "COP",
          initialBalance: 0,
          currentBalance: 0,
          isArchived: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<AccountList />);
    expect(screen.getByText("Ahorros")).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
  });
});
