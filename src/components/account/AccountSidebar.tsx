"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/account/orders", label: "Siparişlerim" },
  { href: "/account/wishlist", label: "Favorilerim" },
  { href: "/account/coupons", label: "Kuponlarım" },
  { href: "/account/addresses", label: "Adreslerim" },
  { href: "/account/settings", label: "Hesap Ayarları" },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (pathname.startsWith(href + "/")) return true;
  return false;
}

export function AccountMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="xl:hidden -mx-4 px-4 overflow-x-auto"
      aria-label="Hesap navigasyonu"
    >
      <div className="flex gap-2 py-2">
        {menuItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                transition-colors
                ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }
              `}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden xl:block">
      <nav
        className="sticky top-6 space-y-1"
        aria-label="Hesap navigasyonu"
      >
        {menuItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                block w-full px-4 py-3 rounded-lg text-sm font-medium
                transition-colors
                ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }
              `}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

