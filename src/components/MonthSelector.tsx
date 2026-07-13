"use client";

import { Button } from "@/components/ui/button";

interface MonthSelectorProps {
  value: string;
  onChange: (period: string) => void;
}

const MONTH_LABELS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

/** Reusable period stepper — also used by the Dashboard module. */
export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Mes anterior"
        onClick={() => onChange(shiftPeriod(value, -1))}
      >
        ‹
      </Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize">
        {formatPeriod(value)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Mes siguiente"
        onClick={() => onChange(shiftPeriod(value, 1))}
      >
        ›
      </Button>
    </div>
  );
}
