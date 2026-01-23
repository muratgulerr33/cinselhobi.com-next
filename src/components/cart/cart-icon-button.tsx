"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

export default function CartIconButton() {
  const { count } = useCart();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-10 w-10 rounded-full transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 [&_svg]:h-5 [&_svg]:w-5"
      aria-label="Sepet"
      asChild
    >
      <Link href="/cart">
        <Icons.cart />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-center text-[10px] font-bold leading-none text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

