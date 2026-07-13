"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTransactionFiltersStore } from "@/stores/transactionFilters.store";

const TYPE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Gastos" },
] as const;

const SELECT_CLASSNAME =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function TransactionFilters() {
  const accountId = useTransactionFiltersStore((state) => state.accountId);
  const categoryId = useTransactionFiltersStore((state) => state.categoryId);
  const type = useTransactionFiltersStore((state) => state.type);
  const dateFrom = useTransactionFiltersStore((state) => state.dateFrom);
  const dateTo = useTransactionFiltersStore((state) => state.dateTo);
  const setAccountId = useTransactionFiltersStore((state) => state.setAccountId);
  const setCategoryId = useTransactionFiltersStore(
    (state) => state.setCategoryId
  );
  const setType = useTransactionFiltersStore((state) => state.setType);
  const setDateFrom = useTransactionFiltersStore((state) => state.setDateFrom);
  const setDateTo = useTransactionFiltersStore((state) => state.setDateTo);
  const clearFilters = useTransactionFiltersStore((state) => state.clearFilters);

  const { data: accounts } = useAccounts(true);
  const { data: categories } = useCategories({ includeArchived: true });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-account">Cuenta</Label>
        <select
          id="filter-account"
          value={accountId ?? ""}
          onChange={(event) => setAccountId(event.target.value || undefined)}
          className={SELECT_CLASSNAME}
        >
          <option value="">Todas</option>
          {accounts?.map((account) => (
            <option key={account._id} value={account._id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-category">Categoría</Label>
        <select
          id="filter-category"
          value={categoryId ?? ""}
          onChange={(event) => setCategoryId(event.target.value || undefined)}
          className={SELECT_CLASSNAME}
        >
          <option value="">Todas</option>
          {categories?.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-type">Tipo</Label>
        <select
          id="filter-type"
          value={type ?? ""}
          onChange={(event) =>
            setType(
              (event.target.value || undefined) as
                | "income"
                | "expense"
                | undefined
            )
          }
          className={SELECT_CLASSNAME}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-date-from">Desde</Label>
        <Input
          id="filter-date-from"
          type="date"
          value={dateFrom ?? ""}
          onChange={(event) => setDateFrom(event.target.value || undefined)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-date-to">Hasta</Label>
        <Input
          id="filter-date-to"
          type="date"
          value={dateTo ?? ""}
          onChange={(event) => setDateTo(event.target.value || undefined)}
        />
      </div>

      <Button variant="ghost" size="sm" onClick={clearFilters}>
        Limpiar filtros
      </Button>
    </div>
  );
}
