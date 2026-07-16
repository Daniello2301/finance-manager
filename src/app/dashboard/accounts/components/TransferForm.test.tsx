import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransferForm } from "@/app/dashboard/accounts/components/TransferForm";

const mutateAsync = vi.fn();
vi.mock("@/hooks/useTransfers", () => ({
  useTransfer: () => ({ mutateAsync, isPending: false }),
}));

const notifySuccess = vi.fn();
vi.mock("@/lib/notifications", () => ({
  notifySuccess: (msg: string) => notifySuccess(msg),
}));

const isInsufficientFunds = vi.fn();
vi.mock("@/lib/api-client", () => ({
  isInsufficientFunds: (err: unknown) => isInsufficientFunds(err),
}));

// A lightweight AccountSelect so the form doesn't have to fetch accounts.
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
    <select
      data-testid={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      <option value="acc-1">Ahorros</option>
      <option value="acc-2">Visa</option>
    </select>
  ),
}));

// The four-exit dialog has its own test; here we only care that it opens.
vi.mock("@/components/InsufficientFundsDialog", () => ({
  InsufficientFundsDialog: ({
    context,
  }: {
    context: { available: number } | null;
  }) =>
    context ? <div data-testid="insufficient-funds-dialog" /> : null,
}));

afterEach(() => {
  vi.clearAllMocks();
});

function renderOpen() {
  return render(<TransferForm open onClose={vi.fn()} />);
}

describe("TransferForm", () => {
  it("blocks a transfer to the same account before hitting the API", async () => {
    const user = userEvent.setup();
    renderOpen();

    await user.selectOptions(screen.getByTestId("transfer-from"), "acc-1");
    await user.selectOptions(screen.getByTestId("transfer-to"), "acc-1");
    await user.type(screen.getByLabelText(/monto/i), "1000");
    await user.click(screen.getByRole("button", { name: /^transferir$/i }));

    expect(
      screen.getByText(/no puedes transferir a la misma cuenta/i)
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("blocks a non-positive amount before hitting the API", async () => {
    const user = userEvent.setup();
    renderOpen();

    await user.selectOptions(screen.getByTestId("transfer-from"), "acc-1");
    await user.selectOptions(screen.getByTestId("transfer-to"), "acc-2");
    await user.type(screen.getByLabelText(/monto/i), "0");
    await user.click(screen.getByRole("button", { name: /^transferir$/i }));

    expect(screen.getByText(/mayor que cero/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits a valid transfer in minor units and confirms success", async () => {
    mutateAsync.mockResolvedValueOnce({ out: {}, in: {} });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TransferForm open onClose={onClose} />);

    await user.selectOptions(screen.getByTestId("transfer-from"), "acc-1");
    await user.selectOptions(screen.getByTestId("transfer-to"), "acc-2");
    await user.type(screen.getByLabelText(/monto/i), "1500");
    await user.click(screen.getByRole("button", { name: /^transferir$/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccountId: "acc-1",
        toAccountId: "acc-2",
        // COP has no minor units, so 1500 major → 1500 minor.
        amount: 1500,
      })
    );
    expect(notifySuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("opens the four-exit dialog when the source can't cover it", async () => {
    isInsufficientFunds.mockReturnValueOnce(true);
    mutateAsync.mockRejectedValueOnce({
      body: { available: 100_000, currency: "COP" },
    });
    const user = userEvent.setup();
    renderOpen();

    await user.selectOptions(screen.getByTestId("transfer-from"), "acc-1");
    await user.selectOptions(screen.getByTestId("transfer-to"), "acc-2");
    await user.type(screen.getByLabelText(/monto/i), "250000");
    await user.click(screen.getByRole("button", { name: /^transferir$/i }));

    await waitFor(() =>
      expect(
        screen.getByTestId("insufficient-funds-dialog")
      ).toBeInTheDocument()
    );
  });
});
