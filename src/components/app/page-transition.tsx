"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect, useLayoutEffect, useContext, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useIsPresent } from "framer-motion";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getMobileTabIndex } from "./mobile-tabs";
import { getActiveTabId } from "./mobile-tabs";
import { consumeTabNavIntent, readTabScroll } from "./tab-scroll";
import Footer from "./Footer";

interface PageTransitionProps {
  children: React.ReactNode;
}

function FrozenRouter({ children }: { children: React.ReactNode }) {
  const isPresent = useIsPresent();
  const context = useContext(LayoutRouterContext);

  // Her keyed instance kendi state'ine sahip olur:
  // - isPresent=true (yeni sayfa / normal render): state güncellenir
  // - isPresent=false (exit animasyonu): state SABİT kalır -> eski sayfa "freeze" olur
  const [frozenContext, setFrozenContext] = useState(context);
  
  // State'i sadece isPresent true olduğunda güncelle
  // useLayoutEffect yerine render sırasında conditional update
  if (isPresent && frozenContext !== context) {
    // Bu bir side effect ama React'in önerdiği pattern değil
    // Alternatif: useSyncExternalStore veya başka bir pattern kullanılabilir
    // Şimdilik bu şekilde bırakıyoruz çünkü animasyon için gerekli
    setFrozenContext(context);
  }

  return (
    <LayoutRouterContext.Provider value={frozenContext}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

function ScreenShell({ children, pathnameKey }: { children: React.ReactNode; pathnameKey: string }) {
  const isPresent = useIsPresent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTabId = getActiveTabId(pathnameKey);

  // Scroll restore - paint'ten önce uygula
  useLayoutEffect(() => {
    if (!isPresent) return;
    if (!scrollRef.current) return;
    if (!currentTabId) return;

    const intent = consumeTabNavIntent();
    if (!intent) return;
    if (intent.toTabId !== currentTabId) return;

    const y = readTabScroll(currentTabId);
    scrollRef.current.scrollTop = y;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = y;
      }
    });
  }, [pathnameKey, currentTabId, isPresent]);

  return (
    <div
      ref={scrollRef}
      data-scroll-container
      data-active={isPresent ? "true" : "false"}
      className="h-[100dvh] overflow-y-auto overscroll-contain bg-background pt-[calc(56px+env(safe-area-inset-top,0px))] pb-[calc(72px+env(safe-area-inset-bottom,0px))] xl:h-auto xl:overflow-visible xl:pt-0 xl:pb-0"
    >
      <div className="mx-auto w-full min-w-0 max-w-screen-2xl px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12">
        {children}
        <div className="xl:hidden">
          <Footer />
        </div>
      </div>
    </div>
  );
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string>(pathname);
  const reducedMotion = useReducedMotion();

  // Önceki pathname'i state ile tut
  const [prevPathname, setPrevPathname] = useState<string>(pathname);

  // Pathname değiştiğinde önceki değeri güncelle
  useEffect(() => {
    const current = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    // Bir sonraki render'da önceki değeri kullan
    setPrevPathname(current);
  }, [pathname]);

  const prevIndex = getMobileTabIndex(prevPathname);
  const currentIndex = getMobileTabIndex(pathname);

  // Direction hesaplama
  let direction = 0;
  if (prevIndex !== null && currentIndex !== null && prevIndex !== currentIndex) {
    if (currentIndex > prevIndex) {
      direction = 1; // sağdan gelsin
    } else {
      direction = -1; // soldan gelsin
    }
  }

  // Reduced motion veya direction 0 ise animasyon yok
  const shouldAnimate = !reducedMotion && direction !== 0;

  // Variant'lar - 3 state: enter / center / exit (opacity kaldırıldı)
  const variants = {
    enter: (dir: number) => ({
      x: dir === 1 ? "100%" : "-100%",
    }),
    center: {
      x: "0%",
    },
    exit: (dir: number) => ({
      x: dir === 1 ? "-100%" : "100%",
    }),
  };

  const transition = shouldAnimate
    ? {
        type: "spring" as const,
        stiffness: 300,
        damping: 35,
        bounce: 0,
      }
    : {
        duration: 0,
      };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="grid w-full min-w-0 max-w-full bg-background" style={{ gridTemplateColumns: '1fr' }}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={pathname}
            custom={direction}
            variants={variants}
            initial={shouldAnimate ? "enter" : "center"}
            animate="center"
            exit={shouldAnimate ? "exit" : undefined}
            transition={transition}
            className="w-full min-w-0 max-w-full bg-background [grid-area:1/1] [will-change:transform]"
          >
            <ScreenShell pathnameKey={pathname}>
              <FrozenRouter>{children}</FrozenRouter>
            </ScreenShell>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

