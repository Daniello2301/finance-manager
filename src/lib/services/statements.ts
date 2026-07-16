import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Transaction from "@/lib/models/Transaction";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { amountDue, cycleFor, type CardCycleConfig } from "@/lib/card-cycle";

export interface Statement {
  /** What you owe the bank in total. Negative on a card. */
  currentBalance: number;
  /** What you must pay by `due` to avoid interest. NOT the balance. */
  amountDue: number;
  /** When that payment is due. */
  due: string;
  /** When the statement being paid closed. */
  close: string;
  /** The statement a purchase made today would land on. */
  nextClose: string;
  nextDue: string;
  currency: string;
}

/**
 * The two numbers a credit card actually has, kept apart on purpose.
 *
 * `currentBalance` is what you owe the bank — a deferred 2.400.000 purchase is
 * in there in full, because your credit limit dropped by all of it the day you
 * bought it. `amountDue` is what THIS statement demands: one instalment, not the
 * whole purchase. Both are true. Reporting either one as the other is the
 * central error this module exists to avoid.
 */
export async function getStatement(
  userId: string,
  accountId: string,
  asOf: Date = new Date()
): Promise<Statement> {
  await connectDB();

  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) {
    throw new NotFoundError("La cuenta no existe o no te pertenece");
  }
  if (account.type !== "credit_card") {
    throw new ValidationError("Esta cuenta no es una tarjeta de crédito");
  }
  // No dates, no cycle. The app does not estimate a payment deadline — a
  // deadline it guessed wrong is worse than no deadline at all.
  if (account.statementDay === undefined || account.paymentDay === undefined) {
    throw new ValidationError(
      "Esta tarjeta no tiene día de corte ni día de pago configurados"
    );
  }

  const config: CardCycleConfig = {
    statementDay: account.statementDay,
    paymentDay: account.paymentDay,
  };

  // Only real purchases count towards a statement. A transfer paying the card
  // off is not a purchase, and neither is a balance adjustment.
  const movements = await Transaction.find({
    userId,
    accountId,
    type: "expense",
    origin: { $exists: false },
  }).select("date amount installmentCount");

  const open = cycleFor(config, asOf);
  const closed = cycleFor(
    config,
    new Date(open.start.getTime() - 24 * 60 * 60 * 1000)
  );

  return {
    currentBalance: account.currentBalance,
    amountDue: amountDue(config, movements, asOf),
    close: closed.close.toISOString().slice(0, 10),
    due: closed.due.toISOString().slice(0, 10),
    nextClose: open.close.toISOString().slice(0, 10),
    nextDue: open.due.toISOString().slice(0, 10),
    currency: account.currency,
  };
}
