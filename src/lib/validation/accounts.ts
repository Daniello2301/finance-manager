import { z } from "zod";

const baseAccountSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(60),
  type: z.enum(["bank", "cash", "credit_card"]),
  currency: z.string().length(3).default("COP"),
  initialBalance: z.number().int("El saldo debe ser un entero"),
  creditLimit: z.number().int().positive().optional(),
  // Both are needed for a cycle to exist, and neither is required — see the
  // model. The route validates them against the *effective* account type, for
  // the same reason creditLimit is validated there (see below).
  statementDay: z.number().int().min(1).max(31).optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const creditLimitRule = {
  message: "creditLimit solo aplica a cuentas tipo tarjeta de crédito",
  path: ["creditLimit"],
};

export const createAccountSchema = baseAccountSchema
  .refine(
    (data) => data.type === "credit_card" || data.creditLimit === undefined,
    creditLimitRule
  )
  .refine(
    (data) =>
      data.type === "credit_card" ||
      (data.statementDay === undefined && data.paymentDay === undefined),
    {
      message:
        "El ciclo de facturación solo aplica a cuentas tipo tarjeta de crédito",
      path: ["statementDay"],
    }
  );

// No .refine() here: on a partial update, a payload of just { creditLimit }
// has no `type` for Zod to check against — only the route (which has the
// stored account) can validate creditLimit against the *effective* type.
//
// `isArchived` is only on the UPDATE schema, never on create (an account can't
// be born archived). It has to be here explicitly: Zod strips unknown keys
// silently, so before this line a PATCH of `{ isArchived: false }` parsed to
// `{}` — the API answered 200 and changed nothing, which made archiving a
// one-way trip with no error to explain why.
export const updateAccountSchema = baseAccountSchema
  .partial()
  .omit({ currency: true })
  .extend({ isArchived: z.boolean().optional() });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
