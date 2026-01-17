"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, CartState } from "./cart-types";
import { CART_STORAGE_KEY, loadCart, normalizeQty, saveCart } from "./cart-store";

type AddPayload = Omit<CartItem, "qty">;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  addItem: (item: AddPayload, qty?: number) => void;
  removeItem: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  inc: (productId: number) => void;
  dec: (productId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ items: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydration için sync setState gerekli - localStorage'dan initial state yükleme
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadCart());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCart(state);
  }, [state, hydrated]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setState(loadCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const count = useMemo(() => state.items.reduce((a, b) => a + (b.qty ?? 0), 0), [state.items]);
  const subtotalCents = useMemo(() => state.items.reduce((a, b) => a + b.priceCents * b.qty, 0), [state.items]);

  const addItem = (item: AddPayload, qty = 1) => {
    const q = normalizeQty(qty);
    setState((prev) => {
      const idx = prev.items.findIndex((x) => x.productId === item.productId);
      if (idx === -1) return { items: [...prev.items, { ...item, qty: q }] };
      const next = [...prev.items];
      next[idx] = { ...next[idx], qty: normalizeQty(next[idx].qty + q) };
      return { items: next };
    });
  };

  const removeItem = (productId: number) => {
    setState((prev) => ({ items: prev.items.filter((x) => x.productId !== productId) }));
  };

  const setQty = (productId: number, qty: number) => {
    const q = normalizeQty(qty);
    setState((prev) => ({
      items: prev.items.map((x) => (x.productId === productId ? { ...x, qty: q } : x)),
    }));
  };

  const inc = (productId: number) => setQty(productId, (state.items.find((x) => x.productId === productId)?.qty ?? 1) + 1);

  const dec = (productId: number) => {
    const current = state.items.find((x) => x.productId === productId)?.qty ?? 1;
    if (current <= 1) removeItem(productId);
    else setQty(productId, current - 1);
  };

  const clear = useCallback(() => {
    setState((prev) => {
      if (prev.items.length === 0) return prev; // ✅ no-op => loop kırılır
      return { ...prev, items: [] };
    });
  }, []);

  const value: CartContextValue = { items: state.items, count, subtotalCents, addItem, removeItem, setQty, inc, dec, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

