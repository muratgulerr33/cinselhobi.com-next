"use client";

import { usePathname } from "next/navigation";
import {
  useRef,
  useEffect,
  useLayoutEffect,
  useContext,
  useState,
  useCallback,
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
  mobileFooter?: ReactNode;
}

const KEYBOARD_TRIGGER_SELECTOR = '[data-kb-trigger="1"]';
const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1280px)";

function isEditableElement(element: HTMLElement): boolean {
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return !element.disabled;
  }
  if (element instanceof HTMLInputElement) {
    return element.type !== "hidden" && !element.disabled && !element.readOnly;
  }
  return false;
}

function inKeyboardScope(element: HTMLElement): boolean {
  return Boolean(element.closest(KEYBOARD_TRIGGER_SELECTOR));
}

function isMobileViewport(): boolean {
  return !window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
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
  mobileFooter,
  pathnameKey,
}: {
  children: ReactNode;
  mobileFooter?: ReactNode;
  pathnameKey: string;
}) {
  const isPresent = useIsPresent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEnsureRef = useRef<{ target: HTMLElement | null; at: number }>({
    target: null,
    at: 0,
  });
  const timeoutIdsRef = useRef<number[]>([]);
  const currentTabId = getActiveTabId(pathnameKey);

  const ensureVisible = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    const container = scrollRef.current;
    if (!container) return;
    if (!isMobileViewport()) return;

    const vv = window.visualViewport;
    const keyboardTop = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const targetTop = vv
      ? vv.offsetTop + vv.height * 0.28
      : window.innerHeight * 0.28;
    const topLimit = 56 + 12;

    let elRect = target.getBoundingClientRect();
    const deltaToTarget = elRect.top - targetTop;
    if (Math.abs(deltaToTarget) > 8) {
      container.scrollBy({ top: deltaToTarget, behavior: "auto" });
    }

    elRect = target.getBoundingClientRect();
    if (elRect.top < topLimit) {
      container.scrollBy({
        top: elRect.top - topLimit - 12,
        behavior: "auto",
      });
    }
    if (elRect.bottom > keyboardTop - 12) {
      container.scrollBy({
        top: elRect.bottom - (keyboardTop - 12) + 16,
        behavior: "auto",
      });
    }

    const scope = target.closest(KEYBOARD_TRIGGER_SELECTOR) as HTMLElement | null;
    const primaryCta = scope?.querySelector<HTMLElement>(
      '[data-kb-cta="1"], button[type="submit"]'
    );
    if (primaryCta) {
      const ctaRect = primaryCta.getBoundingClientRect();
      if (ctaRect.bottom > keyboardTop - 12) {
        container.scrollBy({
          top: ctaRect.bottom - (keyboardTop - 12) + 16,
          behavior: "auto",
        });
      }
    }
  }, []);

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

  useEffect(() => {
    if (!isPresent) return;
    const container = scrollRef.current;
    if (!container) return;

    const clearPendingTimeouts = () => {
      for (const timeoutId of timeoutIdsRef.current) {
        window.clearTimeout(timeoutId);
      }
      timeoutIdsRef.current = [];
    };

    const runEnsure = (target: HTMLElement) => {
      window.requestAnimationFrame(() => {
        if (!target.isConnected) return;
        if (document.activeElement !== target) return;
        if (!isMobileViewport()) return;
        if (!container.contains(target)) return;
        if (!isEditableElement(target)) return;
        if (!inKeyboardScope(target)) return;

        const now = Date.now();
        if (
          lastEnsureRef.current.target === target &&
          now - lastEnsureRef.current.at < 60
        ) {
          return;
        }

        lastEnsureRef.current = { target, at: now };
        ensureVisible(target);
      });
    };

    const scheduleEnsurePasses = (target: HTMLElement, delays: number[]) => {
      for (const delay of delays) {
        const timeoutId = window.setTimeout(() => {
          timeoutIdsRef.current = timeoutIdsRef.current.filter(
            (id) => id !== timeoutId
          );
          runEnsure(target);
        }, delay);
        timeoutIdsRef.current.push(timeoutId);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isMobileViewport()) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!container.contains(target)) return;
      if (!isEditableElement(target)) return;
      if (!inKeyboardScope(target)) return;

      scheduleEnsurePasses(target, [0, 120, 320]);
    };

    const handleViewportChange = () => {
      if (!isMobileViewport()) return;
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return;
      if (!container.contains(activeElement)) return;
      if (!isEditableElement(activeElement)) return;
      if (!inKeyboardScope(activeElement)) return;
      scheduleEnsurePasses(activeElement, [0, 120]);
    };

    container.addEventListener("focusin", handleFocusIn, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", handleViewportChange);
    vv?.addEventListener("scroll", handleViewportChange);

    return () => {
      container.removeEventListener("focusin", handleFocusIn, true);
      vv?.removeEventListener("resize", handleViewportChange);
      vv?.removeEventListener("scroll", handleViewportChange);
      clearPendingTimeouts();
    };
  }, [isPresent, ensureVisible]);

  return (
    <div
      ref={scrollRef}
      data-scroll-container
      data-active={isPresent ? "true" : "false"}
      className={`h-[100dvh] overflow-y-auto overscroll-contain bg-background pt-[calc(56px+env(safe-area-inset-top,0px))] ${
        mobileFooter
          ? "pb-0 xl:pb-0"
          : "pb-[calc(72px+env(safe-area-inset-bottom,0px))] xl:pb-0"
      } xl:h-auto xl:overflow-visible xl:pt-0`}
    >
      <div className="mx-auto w-full min-w-0 max-w-screen-2xl px-4 sm:px-5 md:px-6 lg:px-8 2xl:px-12">
        {children}
      </div>
      {mobileFooter ? (
        <div className="xl:hidden pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {mobileFooter}
        </div>
      ) : null}
    </div>
  );
}

export function PageTransition({ children, mobileFooter }: PageTransitionProps) {
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
            <ScreenShell pathnameKey={pathname} mobileFooter={mobileFooter}>
              <FrozenRouter>{children}</FrozenRouter>
            </ScreenShell>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
