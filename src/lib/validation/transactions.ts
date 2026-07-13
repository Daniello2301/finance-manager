import { z } from "zod";

// A malformed accountId/categoryId would otherwise reach Mongoose as a
// query filter and throw an unhandled CastError (500) instead of a clean
// 422 — validated here before any query runs. A plain regex (rather than
// mongoose.Types.ObjectId.isValid) keeps this schema safe to import from
// client components — mongoose itself depends on Node builtins (fs, net,
// tls...) that break the browser bundle.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "ID inválido");

const baseTransactionSchema = z.object({
  accountId: objectIdSchema,
  categoryId: objectIdSchema,
  type: z.enum(["income", "expense"]),
  amount: z.number().int().positive("El monto debe ser un entero positivo"),
  date: z.coerce.date(),
  description: z.string().max(200).optional(),
});

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
