import { z } from "zod";

export const signupSchema = z
  .object({
    email: z.email("Correo electrónico inválido"),
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[A-Z]/, "La contraseña debe contener una letra mayúscula")
      .regex(/[0-9]/, "La contraseña debe contener un número")
      .regex(/[!@#$%^&*]/, "La contraseña debe contener un carácter especial"),
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
