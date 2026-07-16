"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { useCatchUp, useRecurring, type Recurring } from "@/hooks/useRecurring";

const SHORT_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const HORIZON_DAYS = 31;

/**
 * "What's coming this month" (US5), and the trigger that keeps automatic
 * templates materialised.
 *
 * catch-up runs once on mount — idempotent server-side, so a refresh or a second
 * tab never double-charges. It sits here because the dashboard is the first thing
 * loaded, making "the balance is real when I open the app" (US2) true.
 */
export function UpcomingRecurringWidget() {
  const { data: recurring } = useRecurring(false);
  const catchUp = useCatchUp();

  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    catchUp.mutate();
  }, [catchUp]);

  const today = new Date();
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const upcoming: Recurring[] = (recurring ?? [])
    .filter(
      (r) =>
        !r.isPaused &&
        !r.isArchived &&
        new Date(r.nextDueDate) <= horizon
    )
    .sort(
      (a, b) =>
        new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    )
    .slice(0, 6);

  if (upcoming.length === 0) return null;

  const committed = upcoming
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-medium">
            Próximos vencimientos
          </h2>
          {committed > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatMoney(committed, "COP")} comprometidos
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {upcoming.map((r) => (
            <li
              key={r._id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {r.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {SHORT_DATE.format(new Date(r.nextDueDate))}
                </span>
              </span>
              <span
                className={`shrink-0 font-tabular ${
                  r.type === "income" ? "text-[var(--positive)]" : ""
                }`}
              >
                {r.type === "income" ? "+" : ""}
                {formatMoney(r.amount, "COP")}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
