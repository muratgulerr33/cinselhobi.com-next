"use client";

import Link from "next/link";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import CartIconButton from "@/components/cart/cart-icon-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DesktopNavigation } from "@/components/layout/DesktopNavigation";

export function DesktopHeader() {
  return (
    <header className="hidden h-16 border-b border-border bg-background xl:flex">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12">
        {/* Left: Brand/Logo */}
        <Link
          href="/"
          className="text-lg font-semibold text-foreground transition-colors hover:text-primary"
        >
          cinselhobi
        </Link>

        {/* Center: Navigation */}
        <DesktopNavigation />

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Icons.search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ara..."
              aria-label="Ara"
              className="h-10 w-64 rounded-md border border-input bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          {/* Action Icons */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Kullanıcı hesabı"
            className="h-10 w-10 rounded-full transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 [&_svg]:h-5 [&_svg]:w-5"
            asChild
          >
            <Link href="/account">
              <Icons.user />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Favoriler"
            className="h-10 w-10 rounded-full transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 [&_svg]:h-5 [&_svg]:w-5"
            asChild
          >
            <Link href="/account/wishlist">
              <Icons.heart />
            </Link>
          </Button>
          <CartIconButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

