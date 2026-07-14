import { WifiOffIcon } from "lucide-react";

// Served by the service worker when a navigation fails with no network. It must
// stay a pure static page: no session, no queries, nothing that needs the
// network it is precisely there to apologise for.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOffIcon aria-hidden className="size-10 text-muted-foreground" />
      <h1 className="font-display text-2xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No pudimos contactar el servidor. Tus datos están a salvo — no se ha
        perdido nada. Vuelve a intentarlo cuando recuperes la red.
      </p>
      <p className="max-w-sm text-xs text-muted-foreground">
        La app no guarda tus saldos sin conexión a propósito: preferimos no
        mostrarte una cifra que quizá ya no sea la tuya.
      </p>
    </main>
  );
}
