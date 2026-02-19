"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Home,
  CreditCard,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const adminNavItems: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/orders",
    label: "Siparişler",
    icon: ShoppingBag,
  },
  {
    href: "/admin/products",
    label: "Ürünler",
    icon: Package,
  },
  {
    href: "/admin/payments",
    label: "Ödemeler",
    icon: CreditCard,
  },
  {
    href: "/admin/reports",
    label: "Raporlar",
    icon: BarChart3,
  },
  {
    href: "/admin/customers",
    label: "Müşteriler",
    icon: Users,
  },
  {
    href: "/admin/settings",
    label: "Ayarlar",
    icon: Settings,
    disabled: true,
  },
  {
    href: "/",
    label: "Mağazaya Dön",
    icon: Home,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card p-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Admin Paneli</h2>
      </div>
      <nav className="space-y-1">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isExternal = item.href.startsWith("http");
          const isSectionRoute = item.href !== "/admin" && item.href !== "/" && !item.disabled;
          const isActive = !item.disabled && !isExternal && (
            pathname === item.href ||
            (isSectionRoute && pathname.startsWith(`${item.href}/`))
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={item.disabled ? true : undefined}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              onClick={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                  toast.info("V2’de gelecek");
                }
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                item.disabled
                  ? "text-muted-foreground/60 hover:bg-accent/40 hover:text-muted-foreground/80"
                  : isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
