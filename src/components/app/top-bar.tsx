"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import CartIconButton from "@/components/cart/cart-icon-button";
import { Icons } from "@/components/ui/icons";
import type { MobileHeaderVariant } from "@/lib/mobile-header";
import { cn } from "@/lib/utils";

interface TopBarProps {
  variant?: MobileHeaderVariant;
}

export function TopBar({ variant }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const getScrollEl = () => document.querySelector('[data-scroll-container][data-active="true"]') as HTMLElement | null;

    let el: HTMLElement | null = null;
    let rafId: number | null = null;

    const update = () => {
      setScrolled((el?.scrollTop ?? 0) > 8);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        update();
        rafId = null;
      });
    };

    requestAnimationFrame(() => {
      el = getScrollEl();
      update();
      el?.addEventListener('scroll', onScroll, { passive: true });
    });
    
    return () => {
      el?.removeEventListener('scroll', onScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <header
      data-variant={variant}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 xl:hidden transition-colors",
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border supports-[backdrop-filter]:bg-background/60"
          : "bg-background border-b border-border"
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12">
        <Link
          href="/"
          className="text-lg font-semibold text-foreground transition-colors hover:text-primary"
        >
          cinselhobi
        </Link>
        <div className="flex items-center gap-2">
          <CartIconButton />
          <button
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background transition-colors hover:bg-accent active:scale-[0.98]"
            aria-label="User account"
          >
            <Icons.user className="h-5 w-5" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

