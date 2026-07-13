const CURRENCY_EXPONENTS: Record<string, number> = {
  COP: 0,
  // USD, EUR, etc. added here in the Fase 2 multi-currency module — no
  // schema change needed, every amount is already stored as an integer.
};

function getExponent(currency: string): number {
  const exponent = CURRENCY_EXPONENTS[currency.toUpperCase()];
  if (exponent === undefined) {
    throw new Error(`Moneda no soportada: ${currency}`);
  }
  return exponent;
}

/** User-facing decimal amount (e.g. "500000" typed into a form) -> integer minor units. */
export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** getExponent(currency));
}

/** Integer minor units (as stored in the DB) -> major-unit decimal number. */
export function fromMinorUnits(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** getExponent(currency);
}

/** Integer minor units -> localized display string, e.g. "$1.300.000". */
export function formatMoney(amountMinor: number, currency: string): string {
  const exponent = getExponent(currency);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(fromMinorUnits(amountMinor, currency));
}
