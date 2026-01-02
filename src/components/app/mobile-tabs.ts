// Reserved slug listesi
const RESERVED_SLUGS = [
  "cart",
  "account",
  "urun",
  "about",
  "support",
  "styleguide",
  "gizlilik-ve-guvenlik",
  "odeme-ve-teslimat",
  "cayma-ve-iade-kosullari",
  "mesafeli-satis-sozlesmesi",
  "product",
  "product-category",
  "search",
  "categories",
];

// Kategori route kontrolü
function isCategoryRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0];
    return !RESERVED_SLUGS.includes(slug);
  }
  return false;
}

export type MobileTabId = "home" | "categories" | "cart" | "wishlist" | "profile";

export interface MobileTab {
  id: MobileTabId;
  label: string;
  href: string | null; // cart için null
  orderIndex: number; // home=0, categories=1, cart=2, wishlist=3, profile=4
  match: (pathname: string) => boolean;
}

export const MOBILE_TABS: MobileTab[] = [
  {
    id: "home",
    label: "Anasayfa",
    href: "/",
    orderIndex: 0,
    match: (pathname: string) => pathname === "/",
  },
  {
    id: "categories",
    label: "Kategoriler",
    href: "/categories",
    orderIndex: 1,
    match: (pathname: string) => {
      return (
        isCategoryRoute(pathname) ||
        pathname.startsWith("/urun/") ||
        pathname === "/search" ||
        pathname === "/categories"
      );
    },
  },
  {
    id: "cart",
    label: "Sepet",
    href: null, // drawer açılacak, route push yok
    orderIndex: 2,
    match: (pathname: string) => pathname === "/cart",
  },
  {
    id: "wishlist",
    label: "Favoriler",
    href: "/account/wishlist",
    orderIndex: 3,
    match: (pathname: string) => pathname === "/account/wishlist",
  },
  {
    id: "profile",
    label: "Hesabım",
    href: "/account",
    orderIndex: 4,
    match: (pathname: string) => pathname.startsWith("/account") && pathname !== "/account/wishlist",
  },
];

/**
 * Pathname'den aktif tab ID'sini döndürür
 */
export function getActiveTabId(pathname: string): MobileTabId | null {
  for (const tab of MOBILE_TABS) {
    if (tab.match(pathname)) {
      return tab.id;
    }
  }
  return null;
}

/**
 * Pathname'den tab index'ini döndürür (slide direction için)
 * cart için null döner (drawer olduğu için slide hesabına girmesin)
 * Hiçbir tab match değilse null döner
 */
export function getMobileTabIndex(pathname: string): number | null {
  const tab = MOBILE_TABS.find((t) => t.match(pathname));
  if (!tab) return null;
  // cart için null döndür (slide hesabına girmesin)
  if (tab.id === "cart") return null;
  return tab.orderIndex;
}

