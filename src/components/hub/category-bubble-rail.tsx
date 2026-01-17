"use client";

import { cn } from "@/lib/utils";
import { normalizeCategoryName } from "@/lib/format/normalize-category-name";

export interface CategoryBubble {
  key: string;
  label: string;
  childWcId: number;
  parentSlug: string;
  displayLabel?: string;
}

interface CategoryBubbleRailProps {
  categories: CategoryBubble[];
  onCategoryClick: (category: CategoryBubble) => void;
}

const STOPWORDS = new Set([
  "&",
  "ve",
  "ile",
  "için",
  "icin",
  "özel",
  "ozel",
  "a",
  "an",
  "the",
  "and",
  "of",
  "for",
]);

/**
 * Generates 2-letter initials from category label, ignoring stopwords and symbols.
 * - If 2+ tokens: first letter of first two tokens (e.g., "Sertleşme Pompalar" => "SP")
 * - If 1 token: first 2 letters uppercase (e.g., "Kayganlaştırıcılar" => "KA")
 */
function generateInitials(label: string): string {
  const normalized = normalizeCategoryName(label);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => {
      const trimmed = token.trim();
      // Filter out stopwords and tokens that are only symbols/punctuation
      return (
        trimmed.length > 0 &&
        !STOPWORDS.has(trimmed.toLowerCase()) &&
        /[a-zA-ZçğıöşüÇĞIİÖŞÜ]/.test(trimmed)
      );
    });

  if (tokens.length >= 2) {
    // First letter of first two tokens
    const first = tokens[0]?.[0]?.toLocaleUpperCase("tr-TR") || "";
    const second = tokens[1]?.[0]?.toLocaleUpperCase("tr-TR") || "";
    return first + second;
  } else if (tokens.length === 1) {
    // First 2 letters of single token
    const token = tokens[0];
    const first = token[0]?.toLocaleUpperCase("tr-TR") || "";
    const second = token[1]?.toLocaleUpperCase("tr-TR") || "";
    return first + (second || "");
  }

  // Fallback: use first two non-whitespace characters
  const cleaned = normalized.replace(/\s+/g, "");
  if (cleaned.length >= 2) {
    return (
      cleaned[0]?.toLocaleUpperCase("tr-TR") +
      cleaned[1]?.toLocaleUpperCase("tr-TR")
    );
  }
  return cleaned[0]?.toLocaleUpperCase("tr-TR") || "?";
}

export function CategoryBubbleRail({ categories, onCategoryClick }: CategoryBubbleRailProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full pb-2">
      {/* Fade mask for scroll affordance (right side only) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
      
      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 px-4">
          {categories.map((category) => {
            const displayText = category.displayLabel || category.label;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => onCategoryClick(category)}
                className={cn(
                  "h-11 rounded-full border border-border/50 bg-muted/40 px-4 flex items-center shrink-0",
                  "motion-safe:active:scale-[0.98] transition-transform",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                aria-label={displayText}
              >
                {/* Label */}
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis",
                    "max-w-[160px]"
                  )}
                >
                  {normalizeCategoryName(displayText)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
