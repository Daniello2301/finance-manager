"use client";

import { useSession } from "next-auth/react";
import { useRecentTransactions } from "@/hooks/useDashboard";
import { BalanceSummaryCard } from "./components/BalanceSummaryCard";
import { TrendChart } from "./components/TrendChart";
import { CategoryBreakdownChart } from "./components/CategoryBreakdownChart";
import { BudgetSummaryWidget } from "./components/BudgetSummaryWidget";
import { DebtSummaryWidget } from "./components/DebtSummaryWidget";
import { RecentTransactionsWidget } from "./components/RecentTransactionsWidget";
import { EmptyDashboardState } from "./components/EmptyDashboardState";
import { OverdrawnAlert } from "./components/OverdrawnAlert";

type RecentActivityStatus = "loading" | "error" | "empty" | "data";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: transactions, isLoading, isError } = useRecentTransactions(1);

  const status: RecentActivityStatus = isLoading
    ? "loading"
    : isError
      ? "error"
      : !transactions?.length
        ? "empty"
        : "data";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <h1 className="font-display text-2xl font-semibold">
        Hola, {session?.user?.name}
      </h1>

      {/* Above everything, and outside the "has any transactions" gate: an
          overdrawn account is the one thing the user must not scroll past.
          Renders nothing when there isn't one, which is almost always. */}
      <OverdrawnAlert />

      {/* Outside the "has any transactions" gate on purpose: a debt registered
          before its first payment creates no transaction, so gating this would
          make a freshly-added debt invisible on the dashboard. And "what I owe"
          sits at the same level as "what I have" — it belongs next to it. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BalanceSummaryCard />
        <DebtSummaryWidget />
      </div>

      {status === "error" && (
        <p className="text-destructive">
          No se pudo cargar tu actividad reciente. Intenta de nuevo.
        </p>
      )}

      {status === "empty" && <EmptyDashboardState />}

      {status === "data" && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendChart />
            <CategoryBreakdownChart />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BudgetSummaryWidget />
            <RecentTransactionsWidget />
          </div>
        </>
      )}
    </div>
  );
}
