import Link from "next/link";
import Image from "next/image";
import { HUBS } from "@/config/hub-ui";
import { ChevronRight } from "lucide-react";

export default function HubIndexPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-20 sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Senin İçin Seçtik</h1>
        <p className="mt-2 text-muted-foreground">
          İlgi alanına ve ihtiyacına en uygun dünyayı keşfet.
        </p>
      </div>

      {/* Hub Cards Grid */}
      <div className="grid grid-cols-1 gap-4 ">
        {HUBS.map((hub) => {
          const heroSrc = `/images/hub/hero/${hub.hubSlug}.webp`;
          return (
            <Link
              key={hub.hubSlug}
              href={`/hub/${hub.hubSlug}`}
              className="group relative overflow-hidden rounded-2xl border shadow-sm text-card-foreground transition-transform duration-200 ease-out active:scale-[0.98] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {/* Dark mode premium gradient border */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent opacity-0 dark:group-hover:opacity-30 dark:group-focus-within:opacity-30 pointer-events-none transition-opacity duration-200" />
              {/* Background image */}
              <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-20 mix-blend-multiply dark:mix-blend-overlay [mask-image:linear-gradient(to_bottom,black,transparent)]">
                <Image
                  src={heroSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                {/* Soft overlay */}
                <div className="absolute inset-0 bg-background/60" />
              </div>
              {/* Content */}
              <div className="relative p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold font-bold">{hub.label}</h2>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                      {hub.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
