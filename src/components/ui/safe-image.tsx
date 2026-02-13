"use client";

import * as React from "react";
import Image, { ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * Next/Image wrapper that avoids optimizer errors on 404 (e.g. WP upstream).
 * Uses unoptimized so the request does not go through Next image optimizer;
 * onError shows a placeholder so the UI does not break.
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

  const handleError = React.useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setFailed(true);
      onError?.(e);
    },
    [onError]
  );

  if (failed) {
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
