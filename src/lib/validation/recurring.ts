import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

/**
 * A recurring template.
 *
 * `anchorDay` is NOT accepted from the client — the route derives it from
 * `startDate` (its UTC day-of-month), so the anchor and the date can never
 * disagree. `nextDueDate` is likewise computed server-side (`firstDueDate`),
 * never sent: a client that could pick its own next due date could backfill
 * history, which is exactly what FR-003 forbids.
 */
const baseRecurringSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  type: z.enum(["income", "expense"]),
  amount: z
    .number()
    .int("El monto debe ser un entero")
    .positive("El monto debe ser mayor que cero"),
  accountId: objectIdSchema,
  categoryId: objectIdSchema,
  frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
  startDate: z.coerce.date(),
  autoGenerate: z.boolean(),
  endDate: z.coerce.date().optional(),
});

export const createRecurringSchema = baseRecurringSchema.refine(
  (data) => !data.endDate || data.endDate >= data.startDate,
  { message: "La fecha de fin no puede ser anterior al inicio", path: ["endDate"] }
);

// `isPaused`/`isArchived` are update-only. Declared explicitly: Zod strips
// unknown keys silently, which is exactly how unarchiving was broken before.
export const updateRecurringSchema = baseRecurringSchema.partial().extend({
  isPaused: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

/** Materialise one pending occurrence, optionally at a corrected amount (FR-007). */
export const confirmOccurrenceSchema = z.object({
  occurrenceKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Clave de vencimiento inválida"),
  amount: z
    .number()
    .int("El monto debe ser un entero")
    .positive("El monto debe ser mayor que cero")
    .optional(),
});

/** Advance past one pending occurrence without creating anything (Scenario 6). */
export const skipOccurrenceSchema = z.object({
  occurrenceKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Clave de vencimiento inválida"),
});

export const listRecurringQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
export type ConfirmOccurrenceInput = z.infer<typeof confirmOccurrenceSchema>;
export type SkipOccurrenceInput = z.infer<typeof skipOccurrenceSchema>;
