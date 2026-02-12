"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderContext } from "./header-context";
import { useSearch } from "@/components/search/search-provider";
import { CatalogControls } from "@/components/catalog/catalog-controls";
import { ShareButton } from "@/components/common/share-button";

const RESERVED_SLUGS = [
  "account",
  "urun",
  "cart",
  "styleguide",
  "support",
  "about",
  "product",
  "product-category",
  "api",
  "_next",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
  "search",
  "categories",
  "login",
  "signup",
  "gizlilik-ve-guvenlik",
  "odeme-ve-teslimat",
  "cayma-ve-iade-kosullari",
  "mesafeli-satis-sozlesmesi",
  "hub",
];

function isCategoryRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0];
    return !RESERVED_SLUGS.includes(slug);
  }
  return false;
}

export function HeaderContent() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const isSearchPage = pathname === "/search";
  const isProductDetail = pathname.startsWith("/urun/") || pathname.startsWith("/product/");
  const isLegal = pathname.startsWith("/hukuki") || pathname.startsWith("/legal");
  const isAccount = pathname.startsWith("/account");
  const isCart = pathname === "/cart";
  const isCategoryPage = isCategoryRoute(pathname);
  const isListing = !isHome && !isSearchPage && !isProductDetail && !isLegal && !isAccount && !isCart;
  const showSearch = isHome || (isListing && !isCategoryPage) || isSearchPage;
  const { title, categoryInfo, catalogParams } = useHeaderContext();
  const { openSearch } = useSearch();
  const [scrolled, setScrolled] = useState(false);

  const { sort, minPrice, maxPrice, inStock, subCategoryIds } = catalogParams;

  // Mount anında scrolled state'i doğru set et
  useEffect(() => {
    if (!isHome) {
      requestAnimationFrame(() => {
        setScrolled(false);
      });
      return;
    }

    const getScrollEl = () => document.querySelector('[data-scroll-container][data-active="true"]') as HTMLElement | null;

    let el: HTMLElement | null = null;
    let rafId: number | null = null;

    const update = () => {
      setScrolled((el?.scrollTop ?? 0) > 8);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        update();
        rafId = null;
      });
    };

    // İlk render'da scroll pozisyonunu kontrol et
    requestAnimationFrame(() => {
      el = getScrollEl();
      update();
      el?.addEventListener('scroll', onScroll, { passive: true });
    });

    return () => {
      el?.removeEventListener('scroll', onScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isHome]);

  // Header class'larını tek bir computed string olarak üret
  const getHeaderClasses = () => {
    const base = "fixed top-0 left-0 right-0 z-50 transition-all duration-200 xl:hidden";
    const safe = "pt-[env(safe-area-inset-top,0px)]";

    let stateClasses: string;
    if (isHome && !scrolled) {
      // Home'da scroll=0 iken gerçek transparent
      stateClasses = "bg-transparent border-b border-transparent backdrop-blur-0";
    } else if (isHome && scrolled) {
      // Home'da scroll > 8px iken glass
      stateClasses = cn(
        "bg-background/70 backdrop-blur-md border-b border-border",
        "supports-[backdrop-filter]:bg-background/50"
      );
    } else {
      // Diğer sayfalarda solid
      stateClasses = "bg-background/95 border-b border-border";
    }

    return cn(base, safe, stateClasses);
  };

  return (
    <header className={getHeaderClasses()}>
      <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12">
        <div className="flex h-14 items-center justify-between">
          {/* Sol */}
          <div className="flex items-center justify-start flex-shrink-0">
            {isHome ? (
              <div className="h-11 w-11" aria-hidden="true" />
            ) : (
              <button
                onClick={() => router.back()}
                aria-label="Geri dön"
                className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card shadow-sm transition-all hover:bg-accent active:scale-[0.98]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Orta */}
          <div className="flex-1 min-w-0 flex items-center justify-center px-2">
            {title ? (
              <h1 className="min-w-0 max-w-full truncate text-sm font-semibold tracking-wide text-center">
                {title}
              </h1>
            ) : (
              <Link
                href="/"
                className="min-w-0 max-w-full truncate text-sm font-semibold tracking-[0.2em] uppercase"
              >
                CİNSELHOBİ
              </Link>
            )}
          </div>

          {/* Sağ */}
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            {isCategoryPage && categoryInfo ? (
              <CatalogControls
                categorySlug={categoryInfo.slug}
                childCategories={categoryInfo.childCategories}
                initialSort={sort}
                initialMinPrice={minPrice}
                initialMaxPrice={maxPrice}
                initialInStock={inStock}
                initialSubCategoryIds={subCategoryIds}
              />
            ) : isProductDetail && title ? (
              <ShareButton title={title} />
            ) : showSearch ? (
              <button
                type="button"
                onClick={() => openSearch()}
                aria-label="Ara"
                className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card/50 transition-all hover:bg-accent active:scale-[0.98]"
              >
                <Search className="h-5 w-5" />
              </button>
            ) : (
              <div className="h-11 w-11" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function Header() {
  return <HeaderContent />;
}
