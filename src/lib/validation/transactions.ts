import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

const baseTransactionSchema = z.object({
  accountId: objectIdSchema,
  categoryId: objectIdSchema,
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive("El monto debe ser un entero positivo"),
  date: z.coerce.date(),
  description: z.string().max(200).optional(),
  // A deferred card purchase. It does NOT create a Debt: the card is debited in
  // full (your credit limit really does drop by the whole amount), and this
  // number only changes what each statement demands. A Debt as well would count
  // the same money twice — see .speckit/specs/credit-card.md.
  installmentCount: z
    .number()
    .int("El número de cuotas debe ser un entero")
    .min(2, "Diferir a cuotas requiere al menos 2")
    .max(48)
    .optional(),
});

// No `confirmOverdraft`. It was removed (ratified 2026-07-14): an expense that
// exceeds the available balance can no longer be forced through. The client
// answers "where did the money come from?" instead — a loan, another account, an
// unrecorded income, or a balance adjustment.
export const createTransactionSchema = baseTransactionSchema;

// No .refine() and no .omit() needed — unlike Accounts' creditLimit rule
// or Categories' immutable `type`, Transaction has no cross-field rule
// and no field that must be rejected-not-stripped in a PATCH body.
export const updateTransactionSchema = baseTransactionSchema.partial();

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
