/**
 * Search utilities with Turkish character normalization and fuzzy matching
 */

/**
 * Normalize Turkish text for search (single centralized function)
 * - Lowercase
 * - Map Turkish characters to ASCII equivalents
 * - Remove special characters, keep only letters, numbers, spaces
 * - Collapse multiple spaces to single space
 */
export function searchNormalize(input: string): string {
  let normalized = input.toLowerCase();
  
  // Map Turkish characters to ASCII
  const turkishMap: Record<string, string> = {
    "ı": "i",
    "i": "i",
    "ş": "s",
    "ğ": "g",
    "ç": "c",
    "ö": "o",
    "ü": "u",
    "İ": "i",
    "Ş": "s",
    "Ğ": "g",
    "Ç": "c",
    "Ö": "o",
    "Ü": "u",
  };
  
  for (const [tr, ascii] of Object.entries(turkishMap)) {
    normalized = normalized.replace(new RegExp(tr, "g"), ascii);
  }
  
  // Keep only letters, numbers, spaces (convert others to space)
  normalized = normalized.replace(/[^a-z0-9\s]/g, " ");
  
  // Collapse multiple spaces to single space and trim
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

/**
 * Get compact version (no spaces) for subsequence matching
 */
export function searchNormalizeCompact(input: string): string {
  return searchNormalize(input).replace(/\s+/g, "");
}

/**
 * Legacy alias for backward compatibility
 */
export function normalizeTR(input: string): string {
  return searchNormalize(input);
}

/**
 * Tokenize input string
 */
export function tokenize(input: string): string[] {
  const normalized = searchNormalize(input);
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);
  // Filter out single character tokens (too noisy)
  return tokens.filter((t) => t.length > 1);
}

/**
 * Check if needle is a subsequence of haystack (for missing vowel/letter matching)
 * Both strings should be normalized and compact (no spaces)
 * Example: "geciktrci" is subsequence of "geciktiriciler"
 */
export function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length === 0) return true;
  if (needle.length > haystack.length) return false;
  
  let needleIdx = 0;
  for (let i = 0; i < haystack.length && needleIdx < needle.length; i++) {
    if (haystack[i] === needle[needleIdx]) {
      needleIdx++;
    }
  }
  
  return needleIdx === needle.length;
}

/**
 * Calculate Levenshtein edit distance between two strings
 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Check if query token fuzzy matches target word
 * Uses dynamic threshold based on target length
 */
function isFuzzyWordMatch(queryToken: string, targetWord: string): boolean {
  const queryLen = queryToken.length;
  const targetLen = targetWord.length;
  
  // Very short queries: disable fuzzy or use threshold 1
  if (queryLen < 4) {
    return false;
  }
  
  // Dynamic threshold: max(2, floor(targetLen * 0.25))
  const maxDist = Math.max(2, Math.floor(targetLen * 0.25));
  const distance = editDistance(queryToken, targetWord);
  
  return distance <= maxDist;
}

/**
 * Score text against query
 * Returns 0 if no match, higher score for better matches
 * Supports exact, prefix, contains, subsequence, and fuzzy matching
 */
function scoreText(query: string, text: string): number {
  const normalizedQuery = searchNormalize(query);
  const normalizedText = searchNormalize(text);
  const compactQuery = searchNormalizeCompact(query);
  const compactText = searchNormalizeCompact(text);
  const queryTokens = tokenize(query);
  
  if (queryTokens.length === 0) {
    return 0;
  }
  
  // Exact substring match gets highest score
  if (normalizedText.includes(normalizedQuery)) {
    return 1000;
  }
  
  let totalScore = 0;
  let matchedTokens = 0;
  const textWords = normalizedText.split(/\s+/);
  
  for (const queryToken of queryTokens) {
    let tokenMatched = false;
    let tokenScore = 0;
    
    for (const textWord of textWords) {
      // Exact match
      if (textWord === queryToken) {
        tokenScore = Math.max(tokenScore, 100);
        tokenMatched = true;
      }
      // Prefix match
      else if (textWord.startsWith(queryToken)) {
        tokenScore = Math.max(tokenScore, 80);
        tokenMatched = true;
      }
      // Contains match
      else if (textWord.includes(queryToken)) {
        tokenScore = Math.max(tokenScore, 60);
        tokenMatched = true;
      }
      // Subsequence match (on compact strings) - higher than fuzzy
      else {
        const compactToken = searchNormalizeCompact(queryToken);
        const compactWord = searchNormalizeCompact(textWord);
        if (isSubsequence(compactToken, compactWord)) {
          tokenScore = Math.max(tokenScore, 50);
          tokenMatched = true;
        }
        // Fuzzy match (lowest priority)
        else if (isFuzzyWordMatch(queryToken, textWord)) {
          tokenScore = Math.max(tokenScore, 30);
          tokenMatched = true;
        }
      }
    }
    
    // Also check subsequence on full compact strings (for category matching like "geciktrci" -> "geciktiriciler")
    if (!tokenMatched && compactQuery.length > 0 && compactText.length > 0) {
      if (isSubsequence(compactQuery, compactText)) {
        tokenScore = Math.max(tokenScore, 50);
        tokenMatched = true;
      }
    }
    
    if (tokenMatched) {
      totalScore += tokenScore;
      matchedTokens++;
    }
  }
  
  // All tokens must match for valid result
  if (matchedTokens < queryTokens.length) {
    return 0;
  }
  
  return totalScore;
}

/**
 * Product type for search
 */
export interface SearchProduct {
  id: number;
  name: string;
  slug: string;
  price: number | null;
  images: unknown;
  categorySlugs?: string[];
}

/**
 * Category type for search
 */
export interface SearchCategory {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
}

/**
 * Search result
 */
export interface SearchResult {
  products: Array<SearchProduct & { score: number }>;
  categories: Array<SearchCategory & { score: number }>;
  fallbackCategory?: SearchCategory;
  fallbackItems: Array<SearchProduct & { score: number }>;
}

/**
 * Search catalog (products and categories)
 */
export function searchCatalog({
  query,
  products,
  categories,
}: {
  query: string;
  products: SearchProduct[];
  categories: SearchCategory[];
}): SearchResult {
  const q = query.trim();
  
  // Initialize result with empty arrays - ALWAYS return arrays
  const result: SearchResult = {
    products: [],
    categories: [],
    fallbackItems: [],
  };
  
  if (!q) {
    return result;
  }
  
  // Score products
  const scoredProducts = products
    .map((product) => {
      // Combine product name, slug, and category names for search
      const searchableText = [
        product.name,
        product.slug,
        ...(product.categorySlugs || []),
      ].join(" ");
      
      const score = scoreText(q, searchableText);
      return { ...product, score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  
  // Score categories
  const scoredCategories = categories
    .map((category) => {
      const searchableText = [category.name, category.slug].join(" ");
      const score = scoreText(q, searchableText);
      return { ...category, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  
  result.products = scoredProducts;
  result.categories = scoredCategories;
  
  // Fallback: if no products but categories match
  if (scoredProducts.length === 0 && scoredCategories.length > 0) {
    const fallbackCategory = scoredCategories[0];
    result.fallbackCategory = fallbackCategory;
    
    // Get products in this category and score them
    if (fallbackCategory) {
      const fallbackProducts = products
        .filter((product) => {
          const productCategorySlugs = product.categorySlugs || [];
          return productCategorySlugs.includes(fallbackCategory.slug);
        })
        .map((product) => {
          const searchableText = [
            product.name,
            product.slug,
            ...(product.categorySlugs || []),
          ].join(" ");
          const score = scoreText(q, searchableText);
          return { ...product, score };
        })
        .sort((a, b) => b.score - a.score);
      
      result.fallbackItems = fallbackProducts;
    }
  }
  
  return result;
}

