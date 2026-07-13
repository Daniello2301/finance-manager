import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, PiggyBank, Tags, Wallet } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Wallet,
    title: "Cuentas",
    description:
      "Bancos, efectivo y tarjetas de crédito, con el saldo siempre al día.",
  },
  {
    icon: Tags,
    title: "Categorías",
    description:
      "Organiza cada ingreso y gasto a tu manera, con categorías propias.",
  },
  {
    icon: ArrowLeftRight,
    title: "Transacciones",
    description:
      "Registra movimientos y mira el impacto en tus cuentas al instante.",
  },
  {
    icon: PiggyBank,
    title: "Presupuestos",
    description: "Define límites por categoría y por mes, y sigue tu avance.",
  },
] as const;

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
        <h1 className="max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Tu dinero, con claridad total.
        </h1>
        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          Registra tus cuentas, categorías, transacciones y presupuestos en un
          solo lugar — pensado para pesos colombianos, con tus datos
          completamente privados.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            Crear cuenta gratis
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Iniciar sesión
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center gap-3">
              <Icon className="size-5 text-primary" />
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
