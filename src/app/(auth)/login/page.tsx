import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/forms/LoginForm";
import { GoogleButton } from "@/components/forms/GoogleButton";

export const metadata: Metadata = {
  title: "Iniciar sesión — Finanzas Personales",
};

/**
 * Whether Google is actually wired up in this environment.
 *
 * Read on the server, so only the boolean crosses to the client — never the
 * secret. Without this the button ships to any environment missing the
 * credentials and fails the moment it's pressed: a control that is visibly
 * there and cannot work is worse than no control at all. It also decouples
 * deploying from configuring — the button simply appears once the vars exist.
 */
function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

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
        {/* Suspense because GoogleButton reads the ?error= NextAuth sends back
            on a refused sign-in, and useSearchParams needs a boundary. */}
        {isGoogleConfigured() && (
          <Suspense fallback={null}>
            <div className="mt-4">
              <GoogleButton />
            </div>
          </Suspense>
        )}
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
