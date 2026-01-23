"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/format";
import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface CartViewProps {
  variant?: "page" | "drawer";
}

export function CartView({ variant = "page" }: CartViewProps) {
  const { items, subtotalCents, inc, dec, removeItem, clear } = useCart();
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  const isDrawer = variant === "drawer";

  const handleClear = () => {
    clear();
    setShowClearDialog(false);
  };

  return (
    <div className={cn(isDrawer ? "space-y-3" : "space-y-4")}>
      {isDrawer && (
        <div className="flex items-center justify-between px-4 pt-3">
          <DrawerTitle className="text-lg font-semibold">Sepet</DrawerTitle>
          {items.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Icons.more className="h-4 w-4" />
                  <span className="sr-only">Menü</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setShowClearDialog(true)}
                >
                  <Icons.trash className="mr-2 h-4 w-4" />
                  Sepeti boşalt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {!isDrawer && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mt-1 text-sm text-muted-foreground">Ürünlerini burada yönetebilirsin.</p>
          </div>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm active:scale-[0.98]"
            >
              Temizle
            </button>
          ) : null}
        </div>
      )}

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sepeti boşalt?</AlertDialogTitle>
            <AlertDialogDescription>
              Sepetteki tüm ürünler kaldırılacak. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} variant="destructive">
              Sepeti boşalt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {items.length === 0 ? (
        <div className={cn("rounded-2xl border border-border bg-card", isDrawer ? "p-3" : "p-4")}>
          <p className="text-sm text-muted-foreground">Sepetin boş.</p>
          {isDrawer ? (
            <DrawerClose asChild>
              <button className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-primary-foreground active:scale-[0.98]">
                Alışverişe devam et
              </button>
            </DrawerClose>
          ) : (
            <Link href="/" className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-primary-foreground active:scale-[0.98]">
              Anasayfaya dön
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className={cn("space-y-3")}>
            {items.map((it) => (
              <div key={it.productId} className={cn("rounded-2xl border border-border bg-card", isDrawer ? "p-3" : "p-4")}>
                <div className="flex gap-3">
                  {it.imageUrl ? (
                    <img
                      src={it.imageUrl}
                      alt={it.name}
                      loading="lazy"
                      className="h-16 w-16 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-border bg-background" />
                  )}

                  <div className="min-w-0 flex-1">
                    <Link href={`/urun/${it.slug}`} className="block truncate font-medium">
                      {it.name}
                    </Link>
                    <div className="mt-1 text-sm text-muted-foreground">{formatPrice(it.priceCents)}</div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => dec(it.productId)}
                          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background active:scale-[0.98]"
                          aria-label="Azalt"
                        >
                          −
                        </button>
                        <div className="w-8 text-center text-sm">{it.qty}</div>
                        <button
                          type="button"
                          onClick={() => inc(it.productId)}
                          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background active:scale-[0.98]"
                          aria-label="Arttır"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(it.productId)}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm active:scale-[0.98]"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={cn("rounded-2xl border border-border bg-card", isDrawer ? "p-3" : "p-4")}>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Ara Toplam</div>
              <div className="font-semibold">{formatPrice(subtotalCents)}</div>
            </div>
            {isDrawer ? (
              <DrawerClose asChild>
                <Link
                  href="/checkout"
                  className="mt-3 block w-full rounded-2xl bg-primary px-4 py-3 text-center text-primary-foreground active:scale-[0.98]"
                >
                  Devam Et
                </Link>
              </DrawerClose>
            ) : (
              <Link
                href="/checkout"
                className="mt-3 block w-full rounded-2xl bg-primary px-4 py-3 text-center text-primary-foreground active:scale-[0.98]"
              >
                Devam Et
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

