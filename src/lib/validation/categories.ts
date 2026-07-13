import { z } from "zod";

const baseCategorySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(40),
  type: z.enum(["income", "expense"]),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const createCategorySchema = baseCategorySchema;

// No .refine() here — unlike Accounts' creditLimit, there's no cross-field
// rule for categories. `type` is simply omitted (immutable after create;
// the route rejects a `type` key in the raw body explicitly, see
// src/app/api/categories/[id]/route.ts).
export const updateCategorySchema = baseCategorySchema
  .omit({ type: true })
  .partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
