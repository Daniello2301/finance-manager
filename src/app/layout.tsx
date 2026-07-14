import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Needed for the OG image to resolve to an absolute URL — without it Next
  // warns and social platforms get a relative path they can't fetch.
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  ),
  title: "Finanzas Personales",
  description: "Gestiona tus cuentas, presupuestos y gastos en un solo lugar.",
  applicationName: "Finanzas Personales",
  // iOS ignores the web manifest's `display: standalone` — it reads these meta
  // tags instead. Without them, "Añadir a pantalla de inicio" gives you a
  // bookmark that opens in Safari with its chrome, not an app.
  appleWebApp: {
    capable: true,
    title: "Finanzas",
    // Lets the app paint under the status bar, which is what `viewportFit:
    // "cover"` below already assumes — the two have to agree or the safe-area
    // insets resolve against a viewport iOS isn't actually giving us.
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Finanzas Personales",
    description:
      "Gestiona tus cuentas, presupuestos y gastos en un solo lugar.",
    type: "website",
    locale: "es_CO",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The manifest can only carry one theme_color, but the system UI around an
  // installed app should follow the user's scheme like the app itself does.
  // These meta tags win over the manifest where they're supported.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf8" },
    { media: "(prefers-color-scheme: dark)", color: "#171a19" },
  ],
  // Lets the page paint under the notch and home indicator, which is what makes
  // `env(safe-area-inset-*)` resolve to real values instead of 0 — the Sidebar
  // and Navbar rely on those insets to keep controls out from under the OS
  // chrome. Deliberately no `maximumScale`/`userScalable`: never take pinch-zoom
  // away from someone who needs it.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
