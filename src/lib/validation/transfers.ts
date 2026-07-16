import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const createTransferSchema = z
  .object({
    fromAccountId: objectIdSchema,
    toAccountId: objectIdSchema,
    amount: z
      .number()
      .int("El monto debe ser un entero")
      .positive("El monto debe ser mayor que cero"),
    date: z.coerce.date().optional(),
    description: z.string().trim().max(200).optional(),
  })
  .refine((input) => input.fromAccountId !== input.toAccountId, {
    message: "No puedes transferir a la misma cuenta",
    path: ["toAccountId"],
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
