"use client";

import * as React from "react";
import Image, { ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/** Sadece string src'lerde wp-content kontrolü. Object (StaticImport) için kullanma. */
function isWpContentUrl(src: string): boolean {
  return /wp-content\/uploads/i.test(src);
}

/**
 * Next/Image wrapper that avoids optimizer errors on 404 (e.g. WP upstream).
 * - wp-content URL'lerini render etmez (placeholder'a düşer)
 * - src StaticImport (object) ise ASLA blocked yapılmaz
 * - src boş string / null ise placeholder
 * - unoptimized ile Next optimizer'a sokmaz
 */
export function SafeImage({
  src,
  alt,
  className,
  fill,
  sizes,
  onError,
  ...rest
}: ImageProps) {
  const [failed, setFailed] = React.useState(false);

  const blocked = React.useMemo(() => {
    if (typeof src !== "string") return false;
    return isWpContentUrl(src);
  }, [src]);

  const noSrc = src == null || (typeof src === "string" && src.trim() === "");

  const handleError = React.useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setFailed(true);
      onError?.(e);
    },
    [onError]
  );

  if (failed || blocked || noSrc) {
    return (
      <div
        className={cn(
          "bg-muted flex items-center justify-center",
          fill && "absolute inset-0",
          className
        )}
        role="img"
        aria-label={alt || ""}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      unoptimized
      onError={handleError}
      {...rest}
    />
  );
}
