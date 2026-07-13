import { formatMoney } from "@/lib/money";

interface BudgetProgressProps {
  spentAmount: number;
  limitAmount: number;
  currency: string;
  percentUsed: number;
}

function barColorClass(percentUsed: number): string {
  if (percentUsed >= 100) return "bg-negative";
  if (percentUsed >= 80) return "bg-amber-500";
  return "bg-positive";
}

/** Reusable progress bar — used by Presupuestos and the Dashboard's budget summary widget. */
export function BudgetProgress({
  spentAmount,
  limitAmount,
  currency,
  percentUsed,
}: BudgetProgressProps) {
  const barWidth = Math.min(percentUsed, 100);

  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuenow={percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full transition-all ${barColorClass(percentUsed)}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="font-tabular text-xs text-muted-foreground">
        {formatMoney(spentAmount, currency)} / {formatMoney(limitAmount, currency)} ({percentUsed}%)
      </p>
    </div>
  );
}
