import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "@/components/forms/SignupForm";

export const metadata: Metadata = {
  title: "Crear cuenta — Finanzas Personales",
};

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu cuenta</CardTitle>
        <CardDescription>
          Empieza a organizar tus finanzas en minutos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
