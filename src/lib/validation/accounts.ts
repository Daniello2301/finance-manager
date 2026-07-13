import { z } from "zod";

const baseAccountSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(60),
  type: z.enum(["bank", "cash", "credit_card"]),
  currency: z.string().length(3).default("COP"),
  initialBalance: z.number().int("El saldo debe ser un entero"),
  creditLimit: z.number().int().positive().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const creditLimitRule = {
  message: "creditLimit solo aplica a cuentas tipo tarjeta de crédito",
  path: ["creditLimit"],
};

export const createAccountSchema = baseAccountSchema.refine(
  (data) => data.type === "credit_card" || data.creditLimit === undefined,
  creditLimitRule
);

// No .refine() here: on a partial update, a payload of just { creditLimit }
// has no `type` for Zod to check against — only the route (which has the
// stored account) can validate creditLimit against the *effective* type.
export const updateAccountSchema = baseAccountSchema
  .partial()
  .omit({ currency: true });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
