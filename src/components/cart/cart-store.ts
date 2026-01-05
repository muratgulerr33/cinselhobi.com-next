import type { CartState } from "./cart-types";

export const CART_STORAGE_KEY = "ch.cart";

const emptyState: CartState = { items: [] };

export function normalizeQty(n: number) {
  const x = Math.floor(Number.isFinite(n) ? n : 1);
  if (x < 1) return 1;
  if (x > 99) return 99;
  return x;
}

export function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as CartState;
    if (!parsed || !Array.isArray(parsed.items)) return emptyState;
    // basic sanitize
    return {
      items: parsed.items
        .filter(Boolean)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => ({
          productId: Number(it.productId),
          slug: String(it.slug ?? ""),
          name: String(it.name ?? ""),
          priceCents: Number(it.priceCents ?? 0),
          imageUrl: it.imageUrl ? String(it.imageUrl) : null,
          qty: normalizeQty(Number(it.qty ?? 1)),
        }))
        .filter((it) => Number.isFinite(it.productId) && it.productId > 0 && it.slug && it.name && Number.isFinite(it.priceCents)),
    };
  } catch {
    return emptyState;
  }
}

export function saveCart(state: CartState) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

