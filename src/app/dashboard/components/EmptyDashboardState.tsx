import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function EmptyDashboardState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="max-w-sm text-muted-foreground">
          Aún no has registrado transacciones. Registra la primera para ver tu
          tendencia de ingresos y gastos, la distribución por categoría y el
          progreso de tus presupuestos.
        </p>
        <Link href="/dashboard/transactions" className={buttonVariants()}>
          Registrar mi primera transacción
        </Link>
      </CardContent>
    </Card>
  );
}
