import { z } from "zod";

/**
 * The password rules, as data.
 *
 * The signup schema below is built from this list, and the live checklist under
 * the password field renders from the same list — so the rules the user sees
 * ticking off green cannot drift from the rules the server actually enforces.
 *
 * The "special character" rule used to be a whitelist, `/[!@#$%^&*]/`, which
 * quietly rejected a hyphen, a period, an underscore or a question mark while
 * telling the user only "debe contener un carácter especial". Any non-alphanumeric
 * counts now.
 */
export const PASSWORD_RULES = [
  {
    id: "length",
    label: "Al menos 8 caracteres",
    message: "La contraseña debe tener al menos 8 caracteres",
    test: (value: string) => value.length >= 8,
  },
  {
    id: "uppercase",
    label: "Una letra mayúscula",
    message: "La contraseña debe contener una letra mayúscula",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "Un número",
    message: "La contraseña debe contener un número",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    id: "symbol",
    label: "Un símbolo (por ejemplo . - _ ! ?)",
    message: "La contraseña debe contener un símbolo",
    test: (value: string) => /[^a-zA-Z0-9]/.test(value),
  },
] as const;

// `superRefine` rather than a chain of `.refine()`s: a chain short-circuits, so
// the user was told about one broken rule at a time. This reports every rule the
// password fails, in one pass.
const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) {
      ctx.addIssue({ code: "custom", message: rule.message });
    }
  }
});

export const signupSchema = z
  .object({
    email: z.email("Correo electrónico inválido"),
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
