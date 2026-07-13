"use client";

import { Check, X } from "lucide-react";

import { PASSWORD_RULES } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

/**
 * The password requirements, ticking off as the user types.
 *
 * Before this, the four rules were discovered one failed submit at a time: the
 * form validated on submit and the field showed a single error message, so you
 * learned about the number requirement only after satisfying the uppercase one.
 *
 * Renders straight from `PASSWORD_RULES`, the same list the Zod schema is built
 * from — the checklist can't promise a rule the server doesn't enforce, or miss
 * one it does.
 */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="flex flex-col gap-1" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        const Icon = met ? Check : X;
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              met ? "text-positive" : "text-muted-foreground"
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{rule.label}</span>
            <span className="sr-only">{met ? "(cumplido)" : "(pendiente)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
