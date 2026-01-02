"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
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
          const isActive = !isExternal && pathname === item.href;
          
          if (item.disabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
                  "text-muted-foreground cursor-not-allowed opacity-50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
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

