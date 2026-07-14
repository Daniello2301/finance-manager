import type { MetadataRoute } from "next";

import { INK } from "@/lib/app-icon";

// Hex, because a manifest is JSON read by the OS, not CSS — the oklch tokens in
// globals.css mean nothing to it. This is `--background` (oklch(0.985 0.006 155))
// converted: the colour the OS paints behind the app while it boots, so it must
// match the app's own background or the launch flashes white.
const BACKGROUND = "#f8faf8";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzas Personales",
    short_name: "Finanzas",
    description:
      "Gestiona tus cuentas, presupuestos y gastos en un solo lugar.",
    lang: "es-CO",
    // Installed from the home screen, the app should open on your numbers — not
    // on a landing page selling you a product you already have. Unauthenticated,
    // /dashboard redirects to /login on its own.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BACKGROUND,
    theme_color: INK,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android masks icons to its own shape and only guarantees the inner 80%.
      // Without a maskable variant it falls back to shrinking the "any" icon
      // inside a white circle, which looks like a mistake.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
