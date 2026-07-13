"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordChecklist } from "@/components/forms/PasswordChecklist";

const SIGNUP_FIELDS = ["name", "email", "password", "confirmPassword"] as const;

export function SignupForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  // Drives the live checklist. The rules used to be revealed one failed submit
  // at a time; now they tick off as you type.
  const password = watch("password") ?? "";

  const onSubmit = async (data: SignupInput) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await signIn("credentials", {
          redirect: false,
          email: data.email,
          password: data.password,
        });

        if (result?.error) {
          setError("root", {
            message:
              "Tu cuenta se creó, pero no pudimos iniciar sesión automáticamente. Intenta ingresar manualmente.",
          });
          return;
        }

        router.push("/dashboard");
        return;
      }

      const body = await res.json();

      if (res.status === 409) {
        setError("root", { message: body.error });
      } else if (res.status === 422 && Array.isArray(body.issues)) {
        for (const issue of body.issues) {
          const field = issue.path?.[0];
          if ((SIGNUP_FIELDS as readonly string[]).includes(field)) {
            setError(field as (typeof SIGNUP_FIELDS)[number], {
              message: issue.message,
            });
          } else {
            setError("root", { message: issue.message });
          }
        }
      } else {
        setError("root", { message: "Ocurrió un error. Intenta de nuevo." });
      }
    } catch {
      setError("root", {
        message: "No se pudo conectar con el servidor. Intenta de nuevo.",
      });
    }
    // Deliberately no resetField() on the password fields. It used to run on
    // every failure path, so an "email already registered" 409 — which has
    // nothing to do with the password — wiped what the user had typed and made
    // them enter it again.
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {errors.root?.message && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <PasswordChecklist value={password} />
          {/* The checklist covers the client-side rules; this only ever shows a
              password error the server sent back. */}
          <FieldError errors={[errors.password]} />
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">
            Confirmar contraseña
          </FieldLabel>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </FieldGroup>
    </form>
  );
}
