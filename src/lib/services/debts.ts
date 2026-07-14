import { connectDB } from "@/lib/db";
import Debt, { type IDebt } from "@/lib/models/Debt";
import Transaction, { type ITransaction } from "@/lib/models/Transaction";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { createTransaction } from "@/lib/services/transactions";
import { effectiveRate, replayDebt, type DebtState } from "@/lib/debt-math";

export interface DebtWithState {
  debt: IDebt;
  state: DebtState;
  /** null when the rate is neither known nor derivable. */
  rate: { rate: number; estimated: boolean } | null;
}

function toDebtInput(debt: IDebt) {
  return {
    principal: debt.principal,
    monthlyRate: debt.monthlyRate,
    installmentAmount: debt.installmentAmount,
    installmentCount: debt.installmentCount,
    startDate: debt.startDate,
  };
}

async function paymentsFor(
  userId: string,
  debtIds: string[]
): Promise<Map<string, ITransaction[]>> {
  const payments = await Transaction.findForUser(userId, {
    debtId: { $in: debtIds },
    // `type: "expense"` is load-bearing, not defensive. A debt can also carry an
    // *income* transaction — the disbursement, the borrowed money arriving in an
    // account. Without this filter that income is read back as a payment, and
    // the debt is paid off with the very money it lent you: register a
    // 17.000.000 debt with its disbursement and it reports a balance of zero.
    // It doesn't crash. It just returns a false number about the user's money.
    type: "expense",
  }).sort({ date: 1 });

  const byDebt = new Map<string, ITransaction[]>();
  for (const payment of payments) {
    const key = payment.debtId!.toString();
    const bucket = byDebt.get(key);
    if (bucket) bucket.push(payment);
    else byDebt.set(key, [payment]);
  }
  return byDebt;
}

function buildState(debt: IDebt, payments: ITransaction[]): DebtWithState {
  const input = toDebtInput(debt);
  return {
    debt,
    rate: effectiveRate(input),
    state: replayDebt(
      input,
      payments.map((payment) => ({
        amount: payment.amount,
        date: payment.date,
      }))
    ),
  };
}

export async function listDebtsWithState(
  userId: string,
  includeArchived = false
): Promise<DebtWithState[]> {
  await connectDB();

  const debts = await Debt.findForUser(
    userId,
    includeArchived ? {} : { isArchived: false }
  ).sort({ createdAt: -1 });

  // One query for every debt's payments rather than one per debt.
  const byDebt = await paymentsFor(
    userId,
    debts.map((debt) => debt.id)
  );

  return debts.map((debt) => buildState(debt, byDebt.get(debt.id) ?? []));
}

export async function getDebtState(
  userId: string,
  debtId: string
): Promise<DebtWithState> {
  await connectDB();

  const debt = await Debt.findOne({ _id: debtId, userId });
  if (!debt) {
    throw new NotFoundError("La deuda no existe o no te pertenece");
  }

  const byDebt = await paymentsFor(userId, [debtId]);
  return buildState(debt, byDebt.get(debtId) ?? []);
}

/**
 * Records a payment towards a debt.
 *
 * Delegates to createTransaction() rather than touching the account itself — the
 * Mongo transaction, the `$inc` on Account.currentBalance and the
 * insufficient-funds guard all come for free, and stay in one place.
 */
export async function payDebt(
  userId: string,
  debtId: string,
  input: {
    accountId: string;
    categoryId: string;
    amount: number;
    date: Date;
    description?: string;
  }
): Promise<ITransaction> {
  await connectDB();

  const debt = await Debt.findOne({ _id: debtId, userId });
  if (!debt) {
    throw new NotFoundError("La deuda no existe o no te pertenece");
  }

  return createTransaction(userId, {
    ...input,
    type: "expense",
    debtId,
  });
}

/**
 * Records the borrowed money ARRIVING in one of the user's accounts.
 *
 * Only for debts born from this flow — a user blocked from an expense who says
 * "I borrowed it". The debts already in the app (the owner's 17.000.000, the
 * bank loan, ADDI) are money that landed months ago, outside the app, and is
 * long spent: giving them a disbursement would inject a phantom balance into an
 * account. Hence optional, and never backfilled.
 *
 * Delegates to createTransaction(), like payDebt() — the Mongo transaction and
 * the `$inc` on Account.currentBalance stay in one place. It's an income, so it
 * can never trip the insufficient-funds rule.
 */
export async function disburseDebt(
  userId: string,
  debtId: string,
  input: { accountId: string; categoryId: string; date?: Date }
): Promise<ITransaction> {
  await connectDB();

  const debt = await Debt.findOne({ _id: debtId, userId });
  if (!debt) {
    throw new NotFoundError("La deuda no existe o no te pertenece");
  }
  if (debt.principal === undefined) {
    throw new ValidationError(
      "Esta deuda no tiene un monto registrado, así que no se puede desembolsar"
    );
  }

  const already = await Transaction.exists({
    userId,
    debtId,
    origin: "disbursement",
  });
  if (already) {
    throw new ConflictError("Esta deuda ya tiene un desembolso registrado");
  }

  return createTransaction(userId, {
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: "income",
    amount: debt.principal,
    date: input.date ?? new Date(),
    description: `Desembolso: ${debt.name}`,
    debtId,
    // Load-bearing. Without it this is indistinguishable from a salary, and it
    // would inflate every "income this month" figure the app reports.
    origin: "disbursement",
  });
}

export interface DebtSummary {
  /** Sum of the instalments of every active debt that declares one. */
  monthlyDue: number;
  /** Paid towards debts so far this month. */
  paidThisMonth: number;
  /** Sum of every known outstanding balance. Debts with no data are excluded. */
  totalOutstanding: number;
  /** How many debts we can't compute a balance for — shown, not hidden. */
  unknownCount: number;
  debtsInArrears: number;
  activeCount: number;
}

export async function getDebtSummary(
  userId: string,
  asOf: Date = new Date()
): Promise<DebtSummary> {
  const debts = await listDebtsWithState(userId, false);

  const monthStart = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1)
  );

  let paidThisMonth = 0;
  for (const { state } of debts) {
    for (const payment of state.payments) {
      if (payment.date >= monthStart && payment.date < monthEnd) {
        paidThisMonth += payment.amount;
      }
    }
  }

  return {
    monthlyDue: debts.reduce(
      (sum, { debt }) => sum + (debt.installmentAmount ?? 0),
      0
    ),
    paidThisMonth,
    totalOutstanding: debts.reduce(
      (sum, { state }) => sum + (state.outstanding ?? 0),
      0
    ),
    // Surfaced rather than swallowed: a total that quietly omits three debts is
    // a total that lies.
    unknownCount: debts.filter(({ state }) => state.outstanding === null).length,
    debtsInArrears: debts.filter(({ state }) => state.arrears > 0).length,
    activeCount: debts.length,
  };
}
