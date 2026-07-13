"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTransactionFiltersStore } from "@/stores/transactionFilters.store";

const TYPE_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Gastos" },
] as const;

// Two columns on a phone, free-flowing row from `sm:` up. Full-width cells used
// to force one filter per line, so the five filters plus the clear button stood
// ~390px tall — on a 667px phone they filled the screen and you couldn't see a
// single transaction without scrolling past them.
const FILTER_CELL = "flex min-w-0 flex-col gap-1 sm:w-auto";
// Account and category names are long; they get the full width.
const FILTER_CELL_WIDE = `${FILTER_CELL} col-span-2 sm:col-span-1`;

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

  const [isOpen, setIsOpen] = useState(false);

  const { data: accounts } = useAccounts(true);
  const { data: categories } = useCategories({ includeArchived: true });

  const activeCount = [accountId, categoryId, type, dateFrom, dateTo].filter(
    Boolean
  ).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Collapsed by default on a phone, always open from `md:` up (where the
          filters fit on one row and there's nothing to gain by hiding them). */}
      <Button
        variant="outline"
        size="sm"
        className="self-start md:hidden"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="transaction-filters"
      >
        <SlidersHorizontal aria-hidden="true" />
        Filtros
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <div
        id="transaction-filters"
        className={`${
          isOpen ? "grid" : "hidden"
        } grid-cols-2 items-end gap-3 md:flex md:flex-wrap`}
      >
        <div className={FILTER_CELL_WIDE}>
          <Label htmlFor="filter-account">Cuenta</Label>
          <Select
            id="filter-account"
            value={accountId ?? ""}
            onChange={(event) => setAccountId(event.target.value || undefined)}
          >
            <option value="">Todas</option>
            {accounts?.map((account) => (
              <option key={account._id} value={account._id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        <div className={FILTER_CELL_WIDE}>
          <Label htmlFor="filter-category">Categoría</Label>
          <Select
            id="filter-category"
            value={categoryId ?? ""}
            onChange={(event) => setCategoryId(event.target.value || undefined)}
          >
            <option value="">Todas</option>
            {categories?.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <div className={FILTER_CELL}>
          <Label htmlFor="filter-type">Tipo</Label>
          <Select
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
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Desde/Hasta are a pair and a date input is narrow — side by side. */}
        <div className={FILTER_CELL}>
          <Label htmlFor="filter-date-from">Desde</Label>
          <Input
            id="filter-date-from"
            type="date"
            value={dateFrom ?? ""}
            onChange={(event) => setDateFrom(event.target.value || undefined)}
          />
        </div>

        <div className={FILTER_CELL}>
          <Label htmlFor="filter-date-to">Hasta</Label>
          <Input
            id="filter-date-to"
            type="date"
            value={dateTo ?? ""}
            onChange={(event) => setDateTo(event.target.value || undefined)}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          disabled={activeCount === 0}
          className="col-span-2 sm:col-span-1"
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
