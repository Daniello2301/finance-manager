import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

// The user has been shown their real available balance and chosen to go ahead
// anyway. A per-request decision, never persisted on the transaction.
const confirmOverdraftSchema = z.boolean().optional();

const baseTransactionSchema = z.object({
  accountId: objectIdSchema,
  categoryId: objectIdSchema,
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive("El monto debe ser un entero positivo"),
  date: z.coerce.date(),
  description: z.string().max(200).optional(),
});

export const createTransactionSchema = baseTransactionSchema.extend({
  confirmOverdraft: confirmOverdraftSchema,
});

// No .refine() and no .omit() needed — unlike Accounts' creditLimit rule
// or Categories' immutable `type`, Transaction has no cross-field rule
// and no field that must be rejected-not-stripped in a PATCH body.
export const updateTransactionSchema = baseTransactionSchema.partial().extend({
  confirmOverdraft: confirmOverdraftSchema,
});

export const listTransactionsQuerySchema = z.object({
  accountId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  type: z.enum(["income", "expense"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<
  typeof listTransactionsQuerySchema
>;
