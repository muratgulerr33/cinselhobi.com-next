"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

interface GA4PageViewsProps {
  gaId: string | undefined;
}

export function GA4PageViews({ gaId }: GA4PageViewsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gaId?.trim()) return;
    if (typeof window.gtag !== "function") return;

    const pagePath = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    if (prevPathRef.current === pagePath) return;

    window.gtag("config", gaId, { page_path: pagePath });
    prevPathRef.current = pagePath;
  }, [gaId, pathname, searchParams]);

  return null;
}
