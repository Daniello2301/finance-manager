import { z } from "zod";

// Plain regex, not mongoose.Types.ObjectId.isValid — this schema is also
// imported by BudgetForm.tsx (a client component), and mongoose pulls in
// Node builtins (fs/net/tls/dns) that break the browser bundle.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID inválido");
const periodKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "El período debe tener el formato AAAA-MM");

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
