"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { getCategoryTreeFromHubMap } from "@/config/hub-map";

type DesktopCategory = {
  label: string;
  slug: string;
  children: Array<{ label: string; slug: string }>;
};

// Hub map beklenmedik şekilde boş dönerse desktop menü boş panel kalmasın.
// Bu fallback yalnızca güvenlik amaçlıdır; normal akışta hub-map kullanılmaya devam eder.
const FALLBACK_CATEGORY_TREE: DesktopCategory[] = [
  {
    label: "Erkeklere Özel",
    slug: "erkeklere-ozel",
    children: [],
  },
  {
    label: "Kadınlara Özel",
    slug: "kadinlara-ozel",
    children: [],
  },
  {
    label: "Geciktiriciler",
    slug: "geciktiriciler",
    children: [],
  },
];

function getSafeCategoryTree(): DesktopCategory[] {
  try {
    const tree = getCategoryTreeFromHubMap();
    if (Array.isArray(tree) && tree.length > 0) return tree;
  } catch {
    // Fallback tree kullanılacak.
  }

  return FALLBACK_CATEGORY_TREE;
}

// Nav link class (düz linkler için)
const NAV_LINK_CLASS = "text-sm font-medium text-foreground transition-colors hover:text-primary";
const CATEGORIES_TRIGGER_ID = "desktop-nav-categories-trigger";
const CATEGORIES_CONTENT_ID = "desktop-nav-categories-content";
const CATEGORIES_MENU_VALUE = "categories";
const SKELETON_ROWS = 8;

export function DesktopNavigation() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [categoryTree, setCategoryTree] = useState<DesktopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasCategories = categoryTree.length > 0;
  const clampedActiveIndex = Math.min(activeIndex, Math.max(categoryTree.length - 1, 0));
  const activeCategory = categoryTree[clampedActiveIndex] ?? null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCategoryTree(getSafeCategoryTree());
      setLoading(false);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && value === CATEGORIES_MENU_VALUE) {
      console.log("Kategoriler opened, categoriesCount=", categoryTree.length);
    }
  }, [value, categoryTree.length]);

  return (
    <NavigationMenu
      viewport={false}
      value={value}
      onValueChange={(nextValue) => setValue(nextValue || undefined)}
    >
      <NavigationMenuList className="gap-6">
        {/* 1. Kategoriler - Mega Menu (Dropdown) */}
        <NavigationMenuItem value={CATEGORIES_MENU_VALUE}>
          <NavigationMenuTrigger
            id={CATEGORIES_TRIGGER_ID}
            data-testid="desktop-kategoriler-trigger"
            aria-controls={CATEGORIES_CONTENT_ID}
            className={cn(navigationMenuTriggerStyle(), "text-sm font-medium [&>svg:last-child]:hidden")}
          >
            Kategoriler
            <Icons.down className="ml-1 h-3 w-3 transition-transform duration-300 group-data-[state=open]/navigation-menu:rotate-180" />
          </NavigationMenuTrigger>
          <NavigationMenuContent
            id={CATEGORIES_CONTENT_ID}
            data-testid="desktop-kategoriler-content"
            aria-labelledby={CATEGORIES_TRIGGER_ID}
            className="z-[80] rounded-xl border border-border bg-background text-foreground shadow-xl p-6 w-[900px] max-w-[calc(100vw-3rem)] data-[state=open]:opacity-100"
          >
            {loading ? (
              <div className="grid gap-6 grid-cols-[minmax(280px,300px)_minmax(420px,1fr)] items-start">
                <div className="pr-4 border-r border-border space-y-2 min-w-0">
                  {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                    <div
                      key={`desktop-categories-skeleton-parent-${index}`}
                      className="h-11 rounded-md bg-muted animate-pulse"
                    />
                  ))}
                </div>
                <div className="pl-4 min-w-0 space-y-2">
                  <div className="h-5 w-40 rounded bg-muted animate-pulse" />
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`desktop-categories-skeleton-child-${index}`}
                      className="h-10 rounded-md bg-muted animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : !hasCategories ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Kategori listesi yüklenemedi. Hızlı bağlantılar:
                </p>
                <div className="grid gap-1">
                  {FALLBACK_CATEGORY_TREE.map((category) => (
                    <NavigationMenuLink asChild key={`fallback-${category.slug}`} className="!flex-row !gap-0 !p-0">
                      <Link
                        href={`/${category.slug}`}
                        className="flex w-full items-center justify-between gap-3 h-10 px-3 rounded-md text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      >
                        <span className="min-w-0 flex-1 truncate text-left">{category.label}</span>
                        <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </NavigationMenuLink>
                  ))}
                  <NavigationMenuLink asChild className="!flex-row !gap-0 !p-0">
                    <Link
                      href="/categories"
                      className="flex w-full items-center justify-between gap-3 h-10 px-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    >
                      <span className="min-w-0 flex-1 truncate text-left">Tüm kategoriler</span>
                      <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </NavigationMenuLink>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-[minmax(280px,300px)_minmax(420px,1fr)] items-start">
                {/* Sol Kolon: Parent Kategori Listesi */}
                <div className="pr-4 border-r border-border space-y-1 min-w-0">
                  {categoryTree.map((category, index) => {
                    return (
                      <NavigationMenuLink
                        asChild
                        key={category.slug}
                        className="!flex-row !gap-0 !p-0"
                      >
                        <Link
                          href={`/${category.slug}`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onFocus={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
                            activeIndex === index && "bg-muted/50"
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate text-left">{category.label}</span>
                          <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </NavigationMenuLink>
                    );
                  })}
                </div>

                {/* Sağ Kolon: Child Kategori Listesi */}
                <div className="pl-4 min-w-0 text-left">
                  {activeCategory ? (
                    <>
                      <h3 className="mb-2 text-sm font-semibold text-foreground">
                        {activeCategory.label}
                      </h3>
                      {activeCategory.children.length === 0 ? (
                        <NavigationMenuLink asChild className="!flex-row !gap-0 !p-0">
                          <Link
                            href={`/${activeCategory.slug}`}
                            className="flex w-full items-center justify-between gap-3 h-10 px-3 rounded-md text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                          >
                            <span className="min-w-0 flex-1 truncate text-left">Tümünü Gör</span>
                          </Link>
                        </NavigationMenuLink>
                      ) : (
                        <div className="space-y-1">
                          {activeCategory.children.map((child) => (
                            <NavigationMenuLink asChild key={child.slug} className="!flex-row !gap-0 !p-0">
                              <Link
                                href={`/${child.slug}`}
                                className="flex w-full items-center justify-between gap-3 h-10 px-3 rounded-md text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                              >
                                <span className="min-w-0 flex-1 truncate text-left">{child.label}</span>
                              </Link>
                            </NavigationMenuLink>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid gap-1">
                      {FALLBACK_CATEGORY_TREE.map((category) => (
                        <NavigationMenuLink asChild key={`fallback-active-${category.slug}`} className="!flex-row !gap-0 !p-0">
                          <Link
                            href={`/${category.slug}`}
                            className="flex w-full items-center justify-between gap-3 h-10 px-3 rounded-md text-sm text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                          >
                            <span className="min-w-0 flex-1 truncate text-left">{category.label}</span>
                            <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </NavigationMenuLink>
                      ))}
                      <NavigationMenuLink asChild className="!flex-row !gap-0 !p-0">
                        <Link
                          href="/categories"
                          className="flex w-full items-center justify-between gap-3 h-10 px-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        >
                          <span className="min-w-0 flex-1 truncate text-left">Tüm kategoriler</span>
                          <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </NavigationMenuLink>
                    </div>
                  )}
                </div>
              </div>
            )}
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* 2. Kadınlara Özel - Düz Link */}
        <NavigationMenuItem value="kadinlara-ozel-link">
          <NavigationMenuLink asChild>
            <Link href="/kadinlara-ozel" className={NAV_LINK_CLASS}>
              Kadınlara Özel
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* 3. Erkeklere Özel - Düz Link */}
        <NavigationMenuItem value="erkeklere-ozel-link">
          <NavigationMenuLink asChild>
            <Link href="/erkeklere-ozel" className={NAV_LINK_CLASS}>
              Erkeklere Özel
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* 4. Geciktiriciler - Düz Link */}
        <NavigationMenuItem value="geciktiriciler-link">
          <NavigationMenuLink asChild>
            <Link href="/geciktiriciler" className={NAV_LINK_CLASS}>
              Geciktiriciler
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
