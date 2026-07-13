"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/dashboard/accounts", label: "Cuentas", icon: Wallet },
  { href: "/dashboard/categories", label: "Categorías", icon: Tags },
  {
    href: "/dashboard/transactions",
    label: "Transacciones",
    icon: ArrowLeftRight,
  },
  { href: "/dashboard/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/dashboard/debts", label: "Deudas", icon: Landmark },
] as const;

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 font-display text-sm font-medium tracking-wide text-muted-foreground transition-colors md:min-h-0",
              "hover:bg-accent/60 hover:text-accent-foreground",
              isActive && "border-primary bg-accent text-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ name }: { name?: string | null }) {
  return (
    // pb accounts for the iOS home indicator, which otherwise sits on top of
    // the logout button (this is the bottom-most element in both the drawer
    // and the desktop rail).
    <div className="flex flex-col gap-2 border-t border-border px-4 pt-4 pb-[env(safe-area-inset-bottom)]">
      {name && (
        <span className="truncate text-sm text-foreground">{name}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  // A phone rotated to landscape is ~844px wide — past the `md` breakpoint at
  // which the drawer's trigger and close button disappear and the desktop rail
  // takes over. Without this, rotating with the drawer open left it *open* but
  // with no way to dismiss it: the backdrop kept covering the screen, body
  // scroll stayed locked, and focus stayed trapped inside. Closing on the
  // breakpoint crossing is the fix; hiding the drawer with `md:hidden` is not,
  // because a hidden dialog is still an open one.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const close = () => desktop.matches && setIsOpen(false);
    close();
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);

  return (
    <>
      {/* Mobile top bar — sticky so the only nav entry point on a phone doesn't
          scroll away, and padded for the status bar / notch. */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
        <Link
          href="/dashboard"
          className="font-display text-lg font-semibold"
        >
          Finanzas Personales
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Abrir menú"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Mobile drawer — reuses the shared Dialog primitive (base-ui) for
          focus trapping, Escape-to-close, and aria-modal semantics, rather
          than a hand-rolled overlay that a keyboard/screen-reader user could
          tab straight through into the page behind it. */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 h-dvh max-h-none w-64 max-w-[80vw] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-r border-border p-0 pl-[env(safe-area-inset-left)] sm:max-w-[80vw]"
        >
          <div className="flex h-full flex-col gap-6 py-6">
            <div className="flex items-center justify-between px-4">
              <DialogTitle className="font-display text-lg font-semibold">
                Finanzas Personales
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cerrar menú"
                  />
                }
              >
                <X className="size-5" />
              </DialogClose>
            </div>
            <SidebarNav
              pathname={pathname}
              onNavigate={() => setIsOpen(false)}
            />
            <SidebarFooter name={session?.user?.name} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-card py-6 pl-[env(safe-area-inset-left)] md:flex">
        <Link
          href="/dashboard"
          className="px-4 font-display text-lg font-semibold"
        >
          Finanzas Personales
        </Link>
        <SidebarNav pathname={pathname} />
        <SidebarFooter name={session?.user?.name} />
      </aside>
    </>
  );
}
