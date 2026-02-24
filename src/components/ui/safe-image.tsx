"use client";

import * as React from "react";
import Image, { ImageProps } from "next/image";
import { cn } from "@/lib/utils";

const __safeImageWarned = new Set<string>();

/** Sadece string src'lerde wp-content kontrolü. Object (StaticImport) için kullanma. */
function isWpContentUrl(src: string): boolean {
  return /wp-content\/uploads/i.test(src);
}

/**
 * Next/Image wrapper that avoids optimizer errors on 404 (e.g. WP upstream).
 * - wp-content URL'lerini render etmez (placeholder'a düşer)
 * - src StaticImport (object) ise ASLA blocked yapılmaz
 * - src boş string / null ise placeholder
 * - Internal/StaticImport görsellerde optimizer kullanır, remote URL'de varsayılan unoptimized
 */
export function SafeImage({
  src,
  alt,
  className,
  fill,
  sizes,
  unoptimized: unoptimizedProp,
  onError,
  ...rest
}: ImageProps) {
  const [failed, setFailed] = React.useState(false);

  const blocked = React.useMemo(() => {
    if (typeof src !== "string") return false;
    return isWpContentUrl(src);
  }, [src]);

  const noSrc = src == null || (typeof src === "string" && src.trim() === "");
  const internalSrc = typeof src === "string" && src.startsWith("/");
  const staticImportSrc = typeof src === "object" && src !== null;
  const resolvedUnoptimized =
    unoptimizedProp ?? !(internalSrc || staticImportSrc);
  const resolvedSizes = sizes ?? (fill ? "100vw" : undefined);

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    if (fill && !sizes && typeof src === "string" && !__safeImageWarned.has(src)) {
      __safeImageWarned.add(src);
      console.warn("[SafeImage] missing `sizes` for fill image:", src);
    }
  }

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
      sizes={resolvedSizes}
      className={className}
      unoptimized={resolvedUnoptimized}
      onError={handleError}
      {...rest}
    />
  );
}
