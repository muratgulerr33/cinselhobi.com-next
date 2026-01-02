"use client";

import Link from "next/link";
import Image from "next/image";

interface SearchResultItemProps {
  title: string;
  subtitle?: string;
  href: string;
  imageUrl?: string | null;
  onSelect?: () => void;
}

export function SearchResultItem({
  title,
  subtitle,
  href,
  imageUrl,
  onSelect,
}: SearchResultItemProps) {
  const displayImageUrl = imageUrl || null;

  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40 active:scale-[0.99] min-h-[72px]"
    >
      <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-gray-50 dark:bg-muted">
        {displayImageUrl ? (
          <div className="relative h-full w-full p-2">
            <Image
              src={displayImageUrl}
              alt={title}
              fill
              sizes="56px"
              className="object-contain mix-blend-multiply dark:mix-blend-normal"
              unoptimized
            />
          </div>
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </Link>
  );
}

