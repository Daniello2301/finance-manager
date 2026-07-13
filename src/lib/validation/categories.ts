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
//
// `isArchived` is update-only (a category can't be born archived) and must be
// declared explicitly — Zod strips unknown keys silently, so a PATCH of
// `{ isArchived: false }` used to parse to `{}`: 200 OK, nothing changed.
export const updateCategorySchema = baseCategorySchema
  .omit({ type: true })
  .partial()
  .extend({ isArchived: z.boolean().optional() });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
