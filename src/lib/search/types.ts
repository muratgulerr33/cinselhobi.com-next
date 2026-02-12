/**
 * Strict types for search functionality
 */

export type SearchResultKind = "product" | "category";

export type SearchResultItem = {
  id: string;
  kind: SearchResultKind;
  title: string;
  href: string;
  thumb?: string | null;
  priceText?: string | null;
  subtitle?: string | null;
};

export type SearchCatalogResult = {
  query: string;
  normalizedQuery: string;
  products: SearchResultItem[];
  categories: SearchResultItem[];
  fallbackItems: SearchResultItem[];
  matchedCategoryId?: string | null;
};

