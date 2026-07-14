import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

/**
 * `monthlyRate` is stored as a DECIMAL FRACTION (0.015 = 1.5% a month), never as
 * a percentage. The form shows the user a "% mensual" field and converts once,
 * on submit — the conversion lives in exactly one place because confusing 1.5
 * with 0.015 is a two-orders-of-magnitude error in someone's real money, and
 * that is the kind of bug that ends trust in a finance app.
 */
const baseDebtSchema = z.object({
  // The only required field. See src/lib/models/Debt.ts for why.
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  creditor: z.string().trim().max(60).optional(),
  principal: z
    .number()
    .int("El monto debe ser un entero")
    .positive("El monto debe ser mayor que cero")
    .optional(),
  monthlyRate: z
    .number()
    .min(0, "La tasa no puede ser negativa")
    .max(1, "La tasa mensual no puede superar el 100%")
    .optional(),
  installmentAmount: z
    .number()
    .int("La cuota debe ser un entero")
    .positive("La cuota debe ser mayor que cero")
    .optional(),
  installmentCount: z
    .number()
    .int("El número de cuotas debe ser un entero")
    .positive("Debe haber al menos una cuota")
    .optional(),
  accountNumber: z.string().trim().max(60).optional(),
  startDate: z.coerce.date().optional(),
});

export const createDebtSchema = baseDebtSchema;

// `isArchived` is update-only — a debt can't be born archived. It has to be
// declared explicitly: Zod strips unknown keys silently, which is exactly how
// unarchiving accounts and categories was broken for weeks (200 OK, no change).
export const updateDebtSchema = baseDebtSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

/**
 * A debt payment. `categoryId` is required because Transaction requires one —
 * a payment is a real expense in the ledger, not a special case. The UI
 * preselects an expense category but never invents one behind the user's back.
 *
 * Paying a debt with money you don't have is blocked exactly like any other
 * expense — no `confirmOverdraft`, no override (ratified 2026-07-14).
 */
export const createDebtPaymentSchema = z.object({
  accountId: objectIdSchema,
  categoryId: objectIdSchema,
  amount: z
    .number()
    .int("El monto debe ser un entero")
    .positive("El monto debe ser mayor que cero"),
  date: z.coerce.date(),
  description: z.string().trim().max(200).optional(),
});

/** The borrowed money arriving in one of the user's accounts. */
export const createDisbursementSchema = z.object({
  accountId: objectIdSchema,
  categoryId: objectIdSchema,
  date: z.coerce.date().optional(),
});

export const listDebtsQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type CreateDebtPaymentInput = z.infer<typeof createDebtPaymentSchema>;
