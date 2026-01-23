"use client";

import { useMemo, useState } from "react";
import { useCart } from "./cart-provider";
import { getPrimaryImageUrl } from "@/lib/format";

type AddToCartBarProps = {
  product: {
    id: number;
    slug: string;
    name: string;
    priceCents: number | null;
    images?: unknown;
  };
};

export default function AddToCartBar({ product }: AddToCartBarProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const imageUrl = useMemo(() => getPrimaryImageUrl(product.images), [product.images]);
  const disabled = product.priceCents == null;

  const onAdd = () => {
    if (disabled) return;
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents!,
        imageUrl,
      },
      1
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 400);
  };

  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        aria-label="Sepete ekle"
      >
        {disabled ? "Fiyat yok" : added ? "Eklendi ✓" : "Sepete Ekle"}
      </button>
    </div>
  );
}

