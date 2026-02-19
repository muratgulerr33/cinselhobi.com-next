"use client";

import { usePathname } from "next/navigation";
import {
  useRef,
  useEffect,
  useLayoutEffect,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useIsPresent,
} from "framer-motion";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getMobileTabIndex, getActiveTabId } from "./mobile-tabs";
import { consumeTabNavIntent, readTabScroll } from "./tab-scroll";

interface PageTransitionProps {
  children: ReactNode;
}

function FrozenRouter({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  const context = useContext(LayoutRouterContext);
  const [frozenContext, setFrozenContext] = useState(context);

  // Exit animasyonu sırasında (isPresent=false) router state'i freeze kalsın.
  // Normalde (isPresent=true) güncel context'e senkronla. setState'i async yaparak cascading render uyarısını gideriyoruz.
  useLayoutEffect(() => {
    if (!isPresent) return;
    const id = requestAnimationFrame(() => setFrozenContext(context));
    return () => cancelAnimationFrame(id);
  }, [isPresent, context]);

  return (
    <LayoutRouterContext.Provider value={frozenContext}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

function ScreenShell({
  children,
  pathnameKey,
}: {
  children: ReactNode;
  pathnameKey: string;
}) {
  const isPresent = useIsPresent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTabId = getActiveTabId(pathnameKey);

  // Scroll restore - paint'ten önce uygula
  useLayoutEffect(() => {
    if (!isPresent) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!currentTabId) return;

    const intent = consumeTabNavIntent();
    if (!intent) return;
    if (intent.toTabId !== currentTabId) return;

    const y = readTabScroll(currentTabId);
    el.scrollTop = y;

    requestAnimationFrame(() => {
      const el2 = scrollRef.current;
      if (el2) el2.scrollTop = y;
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
      </div>
    </div>
  );
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string>(pathname);
  const reducedMotion = useReducedMotion();

  // Pathname değiştiğinde önceki değeri bir sonraki render için sakla.
  useEffect(() => {
    prevPathnameRef.current = pathname;
  }, [pathname]);

  // Bu ref okuması, animasyon yönünü "o anki" önceki route'a göre hesaplamak için şart.
  // (Aksi halde yön 0'a düşüp exit animasyonu bozulabiliyor.)
  // eslint-disable-next-line react-hooks/refs
  const prevIndex = getMobileTabIndex(prevPathnameRef.current);
  const currentIndex = getMobileTabIndex(pathname);

  let direction = 0;
  if (prevIndex !== null && currentIndex !== null && prevIndex !== currentIndex) {
    direction = currentIndex > prevIndex ? 1 : -1;
  }

  const shouldAnimate = !reducedMotion && direction !== 0;

  const variants = {
    enter: (dir: number) => ({
      x: dir === 1 ? "100%" : "-100%",
    }),
    center: { x: "0%" },
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
    : { duration: 0 };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div
        className="grid w-full min-w-0 max-w-full bg-background"
        style={{ gridTemplateColumns: "1fr" }}
      >
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
