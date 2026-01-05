import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Timer, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="w-full bg-gray-50 dark:bg-black pt-4 pb-4 md:pt-6 md:pb-10 transition-colors">
      <div className="container mx-auto px-4 md:px-6">
        
        {/* LAYOUT CONTAINER */}
        <div className="flex flex-col md:grid md:grid-cols-3 gap-4 md:gap-4 h-auto md:h-[520px]">
          
          {/* 1. MASTER CARD (HER ZAMAN GÖRÜNÜR) */}
          <Link 
            href="/categories/yeni-sezon"
            className="group relative w-full md:col-span-2 aspect-[16/9] md:aspect-auto md:h-full rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 bg-gray-200 dark:bg-zinc-900"
          >
            <Image
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200&auto=format&fit=crop"
              alt="Yeni Sezon"
              fill
              priority
              className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-95 hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute bottom-0 left-0 p-5 md:p-10 w-full flex flex-col items-start gap-2 md:gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-[10px] md:text-xs font-bold text-white uppercase shadow-sm">
                <Sparkles size={12} className="text-yellow-300" />
                Yeni Sezon
              </span>
              <h2 className="text-3xl md:text-6xl font-black text-white leading-[0.95] tracking-tight drop-shadow-lg">
                TUTKUNU <br />
                <span className="text-primary-foreground">SERBEST BIRAK.</span>
              </h2>
              <div className="mt-2 flex items-center gap-2 bg-white text-black px-5 py-2.5 md:px-6 md:py-3 rounded-full font-bold text-xs md:text-sm transition-transform active:scale-95 group-hover:bg-gray-50 shadow-lg">
                Koleksiyonu Keşfet
                <ArrowRight size={14} className="md:w-4 md:h-4" />
              </div>
            </div>
          </Link>

          {/* 2. & 3. SIDE CARDS WRAPPER */}
          {/* Mobile: Horizontal Scroll (Slider) | Desktop: Vertical Stack */}
          <div className={cn(
            "flex gap-3", // Common gap
            "flex-row overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4", // Mobile: Slider (Negative margin to hit edges)
            "md:flex-col md:overflow-visible md:pb-0 md:mx-0 md:px-0 md:h-full" // Desktop: Stack
          )}>
            
            {/* TOP CARD (FIRSAT) */}
            <Link 
              href="/categories/cok-satanlar"
              className={cn(
                "group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 bg-gray-200 dark:bg-zinc-900",
                "min-w-[85vw] h-[160px] snap-center", // Mobile Sizing
                "md:min-w-0 md:flex-1 md:h-auto" // Desktop Sizing
              )}
            >
              <Image
                src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=800&auto=format&fit=crop"
                alt="İndirim"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-red-900/80 to-transparent mix-blend-multiply" />
              <div className="absolute bottom-0 left-0 p-3 sm:p-5 md:p-6 w-full">
                <div className="flex items-center gap-2 text-white mb-1">
                  <Timer size={14} className="text-red-200 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-100">Günün Fırsatı</span>
                </div>
                <h3 className="text-sm sm:text-lg md:text-2xl font-bold text-white leading-tight">
                  %50 İndirim
                </h3>
              </div>
            </Link>

            {/* BOTTOM CARD (KATEGORİ) */}
            <Link 
              href="/categories/oyuncaklar"
              className={cn(
                "group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 bg-gray-200 dark:bg-zinc-900",
                "min-w-[85vw] h-[160px] snap-center", // Mobile Sizing
                "md:min-w-0 md:flex-1 md:h-auto" // Desktop Sizing
              )}
            >
              <Image
                src="https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=800&auto=format&fit=crop"
                alt="Kategori"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center text-center p-3 sm:p-4 md:p-4">
                <div className="flex flex-col items-center gap-2">
                  <h3 className="text-sm sm:text-lg md:text-2xl font-bold text-white drop-shadow-md leading-tight">
                    Yetişkin <br /> Oyuncakları
                  </h3>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-colors">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </Link>
            
            {/* Mobile Buffer (Sağ tarafta boşluk bırakmak için) */}
            <div className="w-1 md:hidden flex-shrink-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

