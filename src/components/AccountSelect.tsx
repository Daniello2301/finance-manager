"use client";

import { useAccounts } from "@/hooks/useAccounts";

interface AccountSelectProps {
  value?: string;
  onChange: (accountId: string) => void;
  id?: string;
  disabled?: boolean;
}

/**
 * Cross-module select — built here (Cuentas) but shared by Transacciones
 * and Presupuestos once those modules exist. useAccounts() already
 * excludes archived accounts by default, so no extra filtering needed.
 */
export function AccountSelect({
  value,
  onChange,
  id,
  disabled,
}: AccountSelectProps) {
  const { data: accounts, isLoading } = useAccounts();

  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || isLoading}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
    >
      <option value="" disabled>
        {isLoading ? "Cargando cuentas..." : "Selecciona una cuenta"}
      </option>
      {accounts?.map((account) => (
        <option key={account._id} value={account._id}>
          {account.name}
        </option>
      ))}
    </select>
  );
}
