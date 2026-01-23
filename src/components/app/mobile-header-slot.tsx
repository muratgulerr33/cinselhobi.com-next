"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/app/top-bar";
import { getMobileHeaderVariant, type MobileHeaderVariant } from "@/lib/mobile-header";

/**
 * Mobile header slot component.
 * 
 * Route pathname'den variant hesaplar ve TopBar component'ini render eder.
 * İleride TopBar'a variant prop'u geçilebilir.
 */
export function MobileHeaderSlot() {
  const pathname = usePathname();
  const variant = getMobileHeaderVariant(pathname);

  return <TopBar variant={variant} />;
}

