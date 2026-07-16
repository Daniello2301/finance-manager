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
import { SignupForm } from "@/components/forms/SignupForm";
import { GoogleButton } from "@/components/forms/GoogleButton";

export const metadata: Metadata = {
  title: "Crear cuenta — Finanzas Personales",
};

/** See login/page.tsx — only the boolean crosses to the client, never the secret. */
function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

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
        {isGoogleConfigured() && (
          <Suspense fallback={null}>
            <div className="mt-4">
              <GoogleButton label="Registrarse con Google" />
            </div>
          </Suspense>
        )}
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
