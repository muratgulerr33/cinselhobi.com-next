export type MobileHeaderVariant = "home" | "category" | "detail" | "profile";

/**
 * Route pathname'den mobile header variant'ını hesaplar.
 * 
 * Mapping kuralları:
 * - "/" => "home"
 * - pathname startsWith "/urun/" => "detail"
 * - pathname === "/cart" => "detail"
 * - pathname startsWith "/account" => "profile"
 * - pathname in reserved list => "detail"
 * - default: "category" (root slug sayfaları için)
 */
export function getMobileHeaderVariant(pathname: string): MobileHeaderVariant {
  // Home
  if (pathname === "/") {
    return "home";
  }

  // Detail variant: ürün sayfaları ve bazı özel sayfalar
  if (pathname.startsWith("/urun/")) {
    return "detail";
  }

  if (pathname === "/cart") {
    return "detail";
  }

  // Reserved slug'lar için detail variant
  const reservedSlugs = [
    "/styleguide",
    "/about",
    "/support",
    "/gizlilik-ve-guvenlik",
    "/odeme-ve-teslimat",
    "/cayma-ve-iade-kosullari",
    "/mesafeli-satis-sozlesmesi",
  ];

  if (reservedSlugs.includes(pathname)) {
    return "detail";
  }

  // Profile variant: account sayfaları
  if (pathname.startsWith("/account")) {
    return "profile";
  }

  // Default: category (root slug sayfaları için)
  return "category";
}

