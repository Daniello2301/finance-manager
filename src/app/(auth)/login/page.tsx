import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión — Finanzas Personales",
};

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inicia sesión</CardTitle>
        <CardDescription>
          Accede a tus cuentas, presupuestos y gastos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            Regístrate
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
