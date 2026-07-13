"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
              "flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 font-display text-sm font-medium tracking-wide text-muted-foreground transition-colors",
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
    <div className="flex flex-col gap-2 border-t border-border px-4 pt-4">
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

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
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

      {/* Mobile overlay drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col gap-6 border-r border-border bg-card py-6">
            <div className="flex items-center justify-between px-4">
              <span className="font-display text-lg font-semibold">
                Finanzas Personales
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Cerrar menú"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarNav pathname={pathname} onNavigate={() => setIsOpen(false)} />
            <SidebarFooter name={session?.user?.name} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-card py-6 md:flex">
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
