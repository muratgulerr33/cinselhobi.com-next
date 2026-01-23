import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getHubBySlug } from "@/config/hub-ui";
import { getCategoryBySlug, getChildCategoriesByParentWcId } from "@/db/queries/catalog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HubCategoryRail } from "@/components/hub/hub-category-rail";
import { HubFeaturedRail } from "@/components/hub/hub-featured-rail";

interface PageProps {
  params: Promise<{ hubSlug: string }>;
}

export default async function HubDetailPage({ params }: PageProps) {
  const { hubSlug } = await params;
  const hub = getHubBySlug(hubSlug);

  if (!hub) {
    notFound();
  }

  // Get all unique parent slugs from hub cards
  const parentSlugs = Array.from(new Set(hub.cards.map((card) => card.parentSlug)));

  // Fetch all parent categories and their children
  const parentCategories = await Promise.all(
    parentSlugs.map(async (parentSlug) => {
      const parent = await getCategoryBySlug(parentSlug);
      if (!parent) return null;
      const children = await getChildCategoriesByParentWcId(parent.wcId);
      return { parent, children };
    })
  );

  // Create a map of child slug -> wcId (for URL generation)
  const childSlugToWcId = new Map<string, number>();
  // Also create a map of child slug -> exists (for filtering)
  const childSlugExists = new Map<string, boolean>();
  for (const parentData of parentCategories) {
    if (!parentData) continue;
    for (const child of parentData.children) {
      childSlugToWcId.set(child.slug, child.wcId);
      childSlugExists.set(child.slug, true);
    }
  }

  // Filter cards: only show if child category exists (direct_publish > 0) and has wcId
  const visibleCards = hub.cards.filter((card) => {
    if (card.policy === "hidden-if-empty") {
      const exists = childSlugExists.get(card.childSlug) === true;
      const hasWcId = childSlugToWcId.has(card.childSlug);
      return exists && hasWcId;
    }
    return true;
  });

  // Generate hero image source from hubSlug
  const heroSrc = `/images/hub/hero/${hubSlug}.webp`;

  return (
    <div className="space-y-6">
      {/* Back to hubs link */}
      <Link
        href="/hub"
        className="inline-flex items-center gap-2 h-11 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md px-2 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Keşfete Dön</span>
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border h-[280px] sm:h-[320px]">
        <Image
          src={heroSrc}
          alt=""
          fill
          className="object-cover"
          priority
        />
        {/* Cinematic scrim overlays for text readability */}
        {/* Left-to-right gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
        {/* Bottom-to-top gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Content */}
        <div className="relative h-full flex flex-col justify-end p-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">{hub.label}</h1>
          <p className="mt-2 text-lg text-white/85 drop-shadow-sm leading-relaxed max-w-[28rem]">
            {hub.subtitle}
          </p>
          {hub.primaryCta && (
            <Button
              asChild
              size="lg"
              className="mt-4 h-11 w-fit"
            >
              <Link href={hub.primaryCta.href}>
                {hub.primaryCta.label}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Category Bubble Rail + Grid */}
      {visibleCards.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold px-4">Hızlı Keşfet</h2>
          <HubCategoryRail
            categories={visibleCards.map((card) => {
              const childWcId = childSlugToWcId.get(card.childSlug);
              if (!childWcId) return null;
              return {
                key: card.key,
                label: card.label,
                childWcId,
                parentSlug: card.parentSlug,
              };
            }).filter((cat): cat is { key: string; label: string; childWcId: number; parentSlug: string } => cat !== null)}
          />
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-muted-foreground">
          <p className="mb-4">Bu koleksiyonda henüz içerik yok.</p>
          <Link
            href="/hub"
            className="inline-flex items-center justify-center h-11 px-4 rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Keşfete Dön
          </Link>
        </div>
      )}

      {/* Featured Rail (scroll fetch) */}
      {visibleCards.length > 0 && (
        <HubFeaturedRail
          categories={visibleCards.map((card) => {
            const childWcId = childSlugToWcId.get(card.childSlug);
            if (!childWcId) return null;
            return {
              key: card.key,
              label: card.label,
              childWcId,
              parentSlug: card.parentSlug,
            };
          }).filter((cat): cat is { key: string; label: string; childWcId: number; parentSlug: string } => cat !== null)}
        />
      )}
    </div>
  );
}
