"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseJsonOrThrow } from "@/lib/api-client";
import type { CreateTransferInput } from "@/lib/validation/transfers";

/**
 * Moves money between two of the user's own accounts.
 *
 * The missing primitive: before this, a credit card's balance could only ever
 * get more negative, because there was no way to record paying it off.
 */
export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransferInput) => {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await parseJsonOrThrow(res);
      return body.transfer;
    },
    onSuccess: () => {
      // Two accounts moved, two transactions were written, and the categories
      // may have just been created — everything downstream is stale.
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
