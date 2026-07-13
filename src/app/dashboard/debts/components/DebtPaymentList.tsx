"use client";

import { formatMoney } from "@/lib/money";
import type { SplitPayment } from "@/hooks/useDebts";

/**
 * Each payment, split into what it actually did.
 *
 * This is the point of the whole module: "pagué 210.000" tells you nothing;
 * "de esos 210.000, todo se fue en intereses y nada bajó la deuda" tells you
 * everything.
 */
export function DebtPaymentList({ payments }: { payments: SplitPayment[] }) {
  const recent = [...payments].reverse().slice(0, 6);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">Pagos</p>
      <ul className="flex flex-col divide-y divide-border">
        {recent.map((payment, index) => (
          <li
            key={`${payment.date}-${index}`}
            className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <span className="text-xs text-muted-foreground">
              {new Date(payment.date).toLocaleDateString("es-CO")}
            </span>
            <span className="shrink-0 font-tabular text-sm font-medium">
              {formatMoney(payment.amount, "COP")}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {payment.interest === null || payment.principal === null ? (
                "sin desglose"
              ) : (
                <>
                  <span className="font-tabular">
                    {formatMoney(payment.interest, "COP")}
                  </span>{" "}
                  intereses ·{" "}
                  <span className="font-tabular">
                    {formatMoney(payment.principal, "COP")}
                  </span>{" "}
                  capital
                  {!payment.coversInterest && (
                    <span className="ms-1 text-negative">
                      no cubrió los intereses
                    </span>
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
