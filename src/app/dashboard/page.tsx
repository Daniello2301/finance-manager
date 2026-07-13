"use client";

import { useSession } from "next-auth/react";
import { useRecentTransactions } from "@/hooks/useDashboard";
import { BalanceSummaryCard } from "./components/BalanceSummaryCard";
import { TrendChart } from "./components/TrendChart";
import { CategoryBreakdownChart } from "./components/CategoryBreakdownChart";
import { BudgetSummaryWidget } from "./components/BudgetSummaryWidget";
import { RecentTransactionsWidget } from "./components/RecentTransactionsWidget";
import { EmptyDashboardState } from "./components/EmptyDashboardState";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: transactions, isLoading } = useRecentTransactions(1);
  const showEmptyState = !isLoading && transactions?.length === 0;
  const showWidgets = !isLoading && !!transactions && transactions.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="font-display text-2xl font-semibold">
        Hola, {session?.user?.name}
      </h1>

      <BalanceSummaryCard />

      {showEmptyState && <EmptyDashboardState />}

      {showWidgets && (
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
