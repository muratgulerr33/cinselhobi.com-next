"use client";

import { ProductCard as NewProductCard } from "@/components/product/product-card";

interface Product {
  id?: number;
  name: string;
  slug: string;
  price?: number | null;
  images?: unknown;
  stockStatus?: string | null;
  isNew?: boolean;
  badges?: string[];
  handle?: string;
  permalinkSlug?: string;
  title?: string;
}

interface ProductCardProps {
  product: Product;
  className?: string;
  isFavorite?: boolean;
}

export function ProductCard({ product, className, isFavorite }: ProductCardProps) {
  // Map slug
  const slug =
    product.slug ??
    product.handle ??
    product.permalinkSlug ??
    (product.id ? String(product.id) : "");

  // Map title
  const title = product.name ?? product.title ?? "";

  // Map price (kuruş cinsinden)
  let price = 0;
  if (product.price !== null && product.price !== undefined) {
    if (typeof product.price === "string") {
      const parsed = Number.parseFloat(product.price);
      price = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100); // string ise TL cinsinden, kuruşa çevir
    } else if (typeof product.price === "number") {
      price = product.price; // zaten kuruş cinsinden
    }
  }

  // Map images
  let images: string[] = [];
  if (product.images) {
    if (Array.isArray(product.images)) {
      if (product.images.length > 0) {
        const first = product.images[0];
        if (typeof first === "string") {
          // string[] ise direkt kullan
          images = product.images.filter(
            (img): img is string => typeof img === "string"
          );
        } else if (typeof first === "object" && first !== null) {
          // { src/url }[] ise map et
          images = product.images
            .map((img: unknown) => {
              if (typeof img === "object" && img !== null) {
                if ("src" in img && typeof img.src === "string") {
                  return img.src;
                }
                if ("url" in img && typeof img.url === "string") {
                  return img.url;
                }
              }
              return null;
            })
            .filter((url): url is string => typeof url === "string");
        }
      }
    }
  }

  // Map isNew
  const isNew =
    product.isNew ??
    product.badges?.includes("new") ??
    false;

  // Map productId
  const productId = product.id ?? 0;

  return (
    <NewProductCard
      productId={productId}
      slug={slug}
      title={title}
      price={price}
      images={images}
      isNew={isNew}
      className={className}
      isFavorite={isFavorite}
    />
  );
}

