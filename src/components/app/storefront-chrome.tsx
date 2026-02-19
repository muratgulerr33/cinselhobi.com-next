"use client";

import { Suspense, type ReactNode } from "react";
import { HeaderContent } from "@/components/layout/header";
import { DesktopHeader } from "@/components/layout/DesktopHeader";
import { SearchOverlay } from "@/components/search/search-overlay";
import { AgeGate } from "@/components/age/age-gate";
import { PageTransition } from "@/components/app/page-transition";
import Footer from "@/components/app/Footer";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";

interface StorefrontChromeProps {
  children: ReactNode;
}

export function StorefrontChrome({ children }: StorefrontChromeProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Suspense
        fallback={
          <header className="fixed top-0 left-0 right-0 z-50 h-14 xl:h-16 border-b border-border bg-background" />
        }
      >
        <HeaderContent />
      </Suspense>
      <DesktopHeader />
      <SearchOverlay />
      <AgeGate />
      <main className="flex-1 overflow-hidden xl:overflow-visible">
        <PageTransition>{children}</PageTransition>
      </main>
      <div className="hidden xl:block">
        <Footer />
      </div>
      <MobileBottomNav />
    </div>
  );
}
