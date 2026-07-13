import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

// The regex alone only checks shape — it accepts "2026-13". periodRange()
// (src/lib/services/budgets.ts) rolls an out-of-range month over via native
// Date arithmetic, so without this refine a malformed-but-shape-valid
// periodKey could be stored with a periodStart from a different month than
// the string it's paired with.
export const periodKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "El período debe tener el formato AAAA-MM")
  .refine((value) => {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }, "El mes debe estar entre 01 y 12");

export const createBudgetSchema = z.object({
  categoryId: objectIdSchema,
  periodKey: periodKeySchema,
  limitAmount: z.number().int().positive("El límite debe ser un entero positivo"),
});

export const updateBudgetSchema = z.object({
  limitAmount: z.number().int().positive("El límite debe ser un entero positivo"),
});

export const listBudgetsQuerySchema = z.object({
  period: periodKeySchema,
});

export const copyBudgetsSchema = z.object({
  fromPeriod: periodKeySchema,
  toPeriod: periodKeySchema,
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;
export type CopyBudgetsInput = z.infer<typeof copyBudgetsSchema>;
