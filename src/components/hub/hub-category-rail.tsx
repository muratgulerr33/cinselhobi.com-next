"use client";

import { useState } from "react";
import { CategoryBubbleRail, type CategoryBubble } from "./category-bubble-rail";
import { CategoryQuickLookSheet } from "./category-quick-look-sheet";
import { normalizeCategoryName } from "@/lib/format/normalize-category-name";
import { cn } from "@/lib/utils";

interface HubCategoryRailProps {
  categories: CategoryBubble[];
}

const LABEL_OVERRIDES: Record<number, string> = {
  102: "Pompalar",
};

function getDisplayLabel(category: { label: string; childWcId?: number | string }) {
  const id = category.childWcId == null ? null : Number(category.childWcId);
  if (id && LABEL_OVERRIDES[id]) return LABEL_OVERRIDES[id];
  return category.label;
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

function generateInitials(label: string): string {
  const normalized = normalizeCategoryName(label);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => {
      const trimmed = token.trim();
      return (
        trimmed.length > 0 &&
        !STOPWORDS.has(trimmed.toLowerCase()) &&
        /[a-zA-ZçğıöşüÇĞIİÖŞÜ]/.test(trimmed)
      );
    });

  if (tokens.length >= 2) {
    const first = tokens[0]?.[0]?.toLocaleUpperCase("tr-TR") || "";
    const second = tokens[1]?.[0]?.toLocaleUpperCase("tr-TR") || "";
    return first + second;
  } else if (tokens.length === 1) {
    const token = tokens[0];
    const first = token[0]?.toLocaleUpperCase("tr-TR") || "";
    const second = token[1]?.toLocaleUpperCase("tr-TR") || "";
    return first + (second || "");
  }

  const cleaned = normalized.replace(/\s+/g, "");
  if (cleaned.length >= 2) {
    return (
      cleaned[0]?.toLocaleUpperCase("tr-TR") +
      cleaned[1]?.toLocaleUpperCase("tr-TR")
    );
  }
  return cleaned[0]?.toLocaleUpperCase("tr-TR") || "?";
}

export function HubCategoryRail({ categories }: HubCategoryRailProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryBubble | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleCategoryClick = (category: CategoryBubble) => {
    setSelectedCategory(category);
    setSheetOpen(true);
  };

  // Get first 6 categories for 2x3 grid
  const gridItems = categories.slice(0, 6);
  const isOdd = gridItems.length % 2 === 1;

  return (
    <>
      <CategoryBubbleRail
        categories={categories.map(c => ({...c, displayLabel: getDisplayLabel(c)}))}
        onCategoryClick={handleCategoryClick}
      />
      
      {/* Subcategory Grid (2x3) */}
      {gridItems.length > 0 && (
        <div className="px-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            {gridItems.map((category, idx) => {
              const isLast = idx === gridItems.length - 1;
              const shouldSpanFull = isOdd && isLast;
              
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className={cn(
                    "rounded-2xl border border-border/50 bg-card/60 px-4 py-4 min-h-[72px] text-left",
                    "motion-safe:active:scale-[0.99] transition-transform",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "hover:bg-muted/60",
                    shouldSpanFull && "col-span-2"
                  )}
                  aria-label={getDisplayLabel(category)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium truncate">
                      {getDisplayLabel(category)}
                    </div>
                    <span className="opacity-60 text-sm" aria-hidden="true">
                      ›
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <CategoryQuickLookSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={selectedCategory}
      />
    </>
  );
}
