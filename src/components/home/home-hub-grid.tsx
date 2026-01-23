import Image from "next/image";
import Link from "next/link";

const TILES = [
  {
    title: "Erkeklere Özel",
    href: "/hub/erkek-ve-performans",
    imgSrc: "/images/home/hub/home-hub-erkeklere-ozel.webp",
    alt: "Erkeklere özel koleksiyon seçkisi",
  },
  {
    title: "Kadınlara Özel",
    href: "/hub/kadin-ve-haz",
    imgSrc: "/images/home/hub/home-hub-kadinlara-ozel.webp",
    alt: "Kadınlara özel koleksiyon seçkisi",
  },
  {
    title: "Vibratörler",
    href: "/sex-oyuncaklari?sub=223%2C222%2C221%2C220",
    imgSrc: "/images/home/rail/home-rail-vibratorler.webp",
    alt: "Vibratörler ürün seçkisi",
  },
  {
    title: "Geciktiriciler",
    href: "/geciktiriciler",
    imgSrc: "/images/home/rail/home-rail-geciktiriciler.webp",
    alt: "Geciktiriciler ürün seçkisi",
  },
] as const;

export function HomeHubGrid() {
  return (
    <div data-home-hub-clamp className="mx-auto w-full max-w-2xl">
<section aria-label="Hızlı koleksiyonlar" className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image
              src={tile.imgSrc}
              alt={tile.alt}
              fill
              priority
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            <div className="absolute inset-0 flex items-end p-3">
              <span className="text-sm font-semibold text-white drop-shadow-sm">
                {tile.title}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
    </div>
  );
}
