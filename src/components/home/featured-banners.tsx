import Image from "next/image";
import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";

export function FeaturedBanners() {
  return (
    <section className="mt-3">
      <div className="flex flex-col gap-2 py-3">
        <Link
          href="/fantezi-giyim"
          aria-label="Fantezi & İç Giyim koleksiyonuna git"
          className="group relative block aspect-[21/6] w-full overflow-hidden rounded-xl shadow-sm transition-transform motion-reduce:transition-none active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/images/home/banners/featured-fantasy.webp"
            alt="Fantezi & İç Giyim banner görseli"
            fill
            sizes="100vw"
            className="object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          <div className="absolute inset-0 flex items-end p-4">
            <div className="flex items-end gap-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-white/70">
                  Koleksiyon
                </p>
                <p className="text-lg font-semibold leading-tight text-white">
                  Fantezi & İç Giyim
                </p>
                <p className="text-xs text-white/75 line-clamp-1">
                  Hayalinizdeki kostüm burada.
                </p>
              </div>
            </div>
          </div>
        </Link>

        <div className="relative aspect-[21/7] w-full overflow-hidden rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset">
          <Link
            href="/hub/ciftlere-ozel"
            aria-label="Çiftlere Özel hub sayfasına git"
            className="peer absolute inset-0 z-0 rounded-xl focus-visible:outline-none"
          />
          <div className="pointer-events-none absolute inset-0 z-10 transition-transform motion-reduce:transition-none peer-active:scale-[0.99]">
            <Image
              src="/images/home/banners/featured-couples.webp"
              alt="Çiftlere özel banner görseli"
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />

            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />

            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="pointer-events-none relative z-10 flex w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 p-4 text-center text-white backdrop-blur-md">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-white/70">
                    Hub
                  </p>
                  <p className="text-lg font-semibold leading-tight text-white">
                    Çiftlere Özel
                  </p>
                  <p className="text-xs text-white/75 line-clamp-1">
                    Birlikte keşfetmenin hazzı.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/fetis-fantezi"
          aria-label="Fetiş & BDSM koleksiyonuna git"
          className="group relative block aspect-[21/6] w-full overflow-hidden rounded-xl shadow-sm transition-transform motion-reduce:transition-none active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/images/home/banners/featured-fetish.webp"
            alt="Fetiş & BDSM banner görseli"
            fill
            sizes="100vw"
            className="object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent" />

          <div className="absolute inset-0 flex items-end justify-end p-4 text-right text-white">
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/70">
                  Hard Core
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="text-lg font-semibold leading-tight text-white">
                Fetiş & BDSM
              </p>
              <p className="text-xs text-white/75 line-clamp-1">
                Sınırları zorla.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
