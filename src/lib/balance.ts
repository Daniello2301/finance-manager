/**
 * The rules about what an account can spend, and when it is overdrawn.
 *
 * Pure, and deliberately free of Mongoose: the same rule has to run in the
 * browser (AccountCard, the insufficient-funds dialog) and on the server
 * (createTransaction). It used to exist twice — once in the service, once
 * hand-written in AccountCard — which is exactly how the two drift apart.
 *
 * Takes a structural type rather than IAccount so a plain JSON account from the
 * API satisfies it just as well as a Mongoose document.
 */
export interface BalanceAccount {
  type: "bank" | "cash" | "credit_card";
  currentBalance: number;
  creditLimit?: number;
}

/**
 * What the account can actually spend.
 *
 * A credit card's balance runs negative as you use it, so what's spendable is
 * the unused credit — the limit plus the (negative) balance. For bank and cash
 * it's just the balance.
 */
export function availableBalance(account: BalanceAccount): number {
  return account.type === "credit_card"
    ? (account.creditLimit ?? 0) + account.currentBalance
    : account.currentBalance;
}

/**
 * Overdrawn — money that isn't there has already been spent.
 *
 * A credit card sitting at a negative balance is NOT overdrawn: spending money
 * you don't have is what a card is *for*, and that negative number is simply
 * what you owe the bank. A card is overdrawn only once it exceeds its limit.
 */
export function isOverdrawn(account: BalanceAccount): boolean {
  return availableBalance(account) < 0;
}
