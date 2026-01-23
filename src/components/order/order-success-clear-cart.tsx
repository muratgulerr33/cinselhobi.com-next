"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Order success sayfasında cart'ı temizleyen client component.
 * Sadece mount olduğunda bir kez clear() çağırır.
 */
export function OrderSuccessClearCart() {
  const didClearRef = useRef(false);
  const { items, clear } = useCart();

  useEffect(() => {
    if (didClearRef.current) return;

    // zaten boşsa bir daha clear çağırma
    if (items.length === 0) {
      didClearRef.current = true;
      return;
    }

    clear();
    didClearRef.current = true;
  }, [items.length, clear]);

  return null;
}
