"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { StorefrontChrome } from "@/components/app/storefront-chrome";

interface AppRouteChromeProps {
  children: ReactNode;
}

export function AppRouteChrome({ children }: AppRouteChromeProps) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdmin) {
    return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
  }

  return <StorefrontChrome>{children}</StorefrontChrome>;
}
