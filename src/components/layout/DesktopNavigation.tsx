"use client";

import { useState } from "react";
import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

// Category tree data model
const categoryTree = [
  {
    label: "Kadınlara Özel",
    slug: "kadinlara-ozel",
    children: [
      { label: "Şişme Erkekler", slug: "sisme-erkekler" },
      { label: "Bayan İstek Arttırıcılar", slug: "bayan-istek-arttiricilar" },
      { label: "Fantezi Giyim", slug: "fantezi-giyim" },
      { label: "Fetiş ve Fantezi", slug: "fetis-ve-fantezi" },
    ],
  },
  {
    label: "Erkeklere Özel",
    slug: "erkeklere-ozel",
    children: [
      { label: "Şişme Kadınlar", slug: "sisme-kadinlar" },
      { label: "Penis Pompaları", slug: "penis-pompalari" },
      { label: "Suni Vajina Mastürbatörler", slug: "suni-vajina-masturbatorler" },
      { label: "Halka ve Kılıflar", slug: "halka-ve-kiliflar" },
    ],
  },
  {
    label: "Sex Oyuncakları",
    slug: "sex-oyuncaklari",
    children: [
      { label: "Belden Bağlamalılar", slug: "belden-baglamalilar" },
      { label: "Et Dokulu Ürünler", slug: "et-dokulu-urunler" },
      { label: "Modern Vibratörler", slug: "modern-vibratorler" },
      { label: "Realistik Dildolar", slug: "realistik-dildolar" },
      { label: "Sex Makinaları", slug: "sex-makineleri" },
    ],
  },
  {
    label: "Kozmetik",
    slug: "kozmetik",
    children: [
      { label: "Prezervatifler", slug: "prezervatifler" },
      { label: "Parfümler", slug: "parfumler" },
      { label: "Masaj Yağları", slug: "masaj-yaglari" },
    ],
  },
  { label: "Geciktiriciler", slug: "geciktiriciler", children: [] },
  { label: "Kayganlaştırıcı Jeller", slug: "kayganlastirici-jeller", children: [] },
  { label: "Anal Oyuncaklar", slug: "anal-oyuncaklar", children: [] },
  { label: "Realistik Mankenler", slug: "realistik-mankenler", children: [] },
];

// Nav link class (düz linkler için)
const NAV_LINK_CLASS = "text-sm font-medium text-foreground transition-colors hover:text-primary";

export function DesktopNavigation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCategory = categoryTree[activeIndex];

  return (
    <NavigationMenu>
      <NavigationMenuList className="gap-6">
        {/* 1. Kategoriler - Mega Menu (Dropdown) */}
        <NavigationMenuItem>
          <NavigationMenuTrigger className={cn(navigationMenuTriggerStyle(), "text-sm font-medium [&>svg:last-child]:hidden")}>
            Kategoriler
            <Icons.down className="ml-1 h-3 w-3 transition-transform duration-300 group-data-[state=open]/navigation-menu:rotate-180" />
          </NavigationMenuTrigger>
          <NavigationMenuContent className="rounded-xl border border-border bg-background shadow-xl p-6 w-[900px] max-w-[calc(100vw-3rem)]">
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
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* 2. Kadınlara Özel - Düz Link */}
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/kadinlara-ozel" className={NAV_LINK_CLASS}>
              Kadınlara Özel
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* 3. Erkeklere Özel - Düz Link */}
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/erkeklere-ozel" className={NAV_LINK_CLASS}>
              Erkeklere Özel
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        {/* 4. Geciktiriciler - Düz Link */}
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/geciktiriciler" className={NAV_LINK_CLASS}>
              Geciktiriciler
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuViewport className="z-[80]" />
    </NavigationMenu>
  );
}
