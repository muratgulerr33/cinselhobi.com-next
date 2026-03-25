"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart/cart-provider";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CartView } from "@/components/cart/cart-view";
import { MOBILE_TABS, getActiveTabId, type MobileTabId } from "./mobile-tabs";
import { saveTabScroll, setTabNavIntent } from "./tab-scroll";
import {
  setTawkSuppressed,
  TAWK_SUPPRESSION_SOURCES,
} from "@/components/integrations/tawk/tawk-visibility";

interface MobileBottomNavProps {
  user?: { name?: string | null; imageUrl?: string | null } | null;
  cartCount?: number;
  hasUnread?: boolean;
}

const KEYBOARD_INSET_THRESHOLD = 80;
const KEYBOARD_TRIGGER_SELECTOR = '[data-kb-trigger="1"]';

// Kullanıcı adının baş harflerini al
function getInitials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0]?.toUpperCase() || "";
}

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return !element.disabled;
  }
  if (element instanceof HTMLInputElement) {
    return element.type !== "hidden" && !element.disabled && !element.readOnly;
  }
  return false;
}

function isElementInKeyboardTriggerScope(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest(KEYBOARD_TRIGGER_SELECTOR)) return true;

  const formOwner =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
      ? element.form
      : element.closest("form");
  if (formOwner?.closest(KEYBOARD_TRIGGER_SELECTOR)) return true;

  const triggerRoots = document.querySelectorAll<HTMLElement>(KEYBOARD_TRIGGER_SELECTOR);
  return Array.from(triggerRoots).some((triggerRoot) => triggerRoot.contains(element));
}

export function MobileBottomNav({
  user,
  cartCount: propCartCount,
  hasUnread = false,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const [cartOpen, setCartOpen] = useState(false);
  const [isKeyboardOpenForTrigger, setIsKeyboardOpenForTrigger] = useState(false);
  const { count: cartCountFromStore } = useCart();

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;
    let baselineHeight = vv.height;
    let rafId: number | null = null;

    const updateKeyboardState = () => {
      const activeElement = document.activeElement;
      const isEditable = isEditableElement(activeElement);
      const isTriggerFocused = isElementInKeyboardTriggerScope(activeElement);
      const inset = Math.max(0, baselineHeight - vv.height);
      const isTrackingTrigger = isEditable && isTriggerFocused;

      // Trigger odakta değilken (veya keyboard tamamen kapalıyken) baseline'ı güncel tut.
      if (!isTrackingTrigger || inset < 1) {
        baselineHeight = vv.height;
      }

      setIsKeyboardOpenForTrigger(
        isTrackingTrigger && inset >= KEYBOARD_INSET_THRESHOLD
      );
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateKeyboardState();
      });
    };

    scheduleUpdate();

    vv.addEventListener("resize", scheduleUpdate);
    vv.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("focusin", scheduleUpdate);
    window.addEventListener("focusout", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);

    return () => {
      vv.removeEventListener("resize", scheduleUpdate);
      vv.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("focusin", scheduleUpdate);
      window.removeEventListener("focusout", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    setTawkSuppressed(TAWK_SUPPRESSION_SOURCES.mobileCartDrawer, cartOpen);

    return () => {
      setTawkSuppressed(TAWK_SUPPRESSION_SOURCES.mobileCartDrawer, false);
    };
  }, [cartOpen]);
  
  // Product detail sayfalarında bottom nav gizle
  if (pathname?.startsWith("/urun/")) {
    return null;
  }
  
  // Cart count: prop öncelikli, yoksa store'dan al
  const cartCount = propCartCount ?? cartCountFromStore;
  const displayCartCount = cartCount > 0 ? (cartCount > 99 ? "99+" : String(cartCount)) : null;

  // Aktif tab belirleme (drawer açıkken veya /cart route'unda sepet aktif sayılır)
  const baseActiveTab = getActiveTabId(pathname);
  const isCartActive = cartOpen || pathname === "/cart";
  const activeTab: MobileTabId | null = isCartActive ? "cart" : baseActiveTab;

  // Tab icon mapping
  const tabIcons: Record<MobileTabId, typeof Icons.home> = {
    home: Icons.home,
    categories: Icons.compass,
    cart: Icons.cart,
    wishlist: Icons.heart,
    profile: Icons.user,
  };

  // MOBILE_TABS'ı kullanarak tab'ları oluştur (orderIndex'e göre sırala)
  const tabs = [...MOBILE_TABS].sort((a, b) => a.orderIndex - b.orderIndex).map((tab) => ({
    ...tab,
    icon: tabIcons[tab.id],
    badge: tab.id === "cart" ? displayCartCount : undefined,
    isCart: tab.id === "cart",
    hasDot: tab.id === "profile" ? hasUnread : undefined,
    isAvatar: tab.id === "profile" && !!user,
    user: tab.id === "profile" ? user : undefined,
  }));

  return (
    <Drawer open={cartOpen} onOpenChange={setCartOpen} shouldScaleBackground>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 xl:hidden border-t border-gray-100 bg-white pt-2 pb-2 pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-black",
          "transform-gpu transition-transform transition-opacity duration-200",
          isKeyboardOpenForTrigger && "translate-y-[110%] opacity-0 pointer-events-none"
        )}
        aria-label="Bottom Navigation"
      >
        <div className="flex items-stretch justify-between">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                // Sepet tab'ı için button (drawer aç), diğerleri için Link
                if (tab.isCart) {
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setCartOpen(true);
                      }}
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-1 py-1 min-h-11",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "active:opacity-90",
                        isActive ? "text-black dark:text-white" : "text-gray-600 dark:text-white/70"
                      )}
                      aria-label="Sepet"
                      aria-current={isActive ? "page" : undefined}
                    >
                      <div className="relative flex flex-col items-center justify-center gap-1">
                        {/* Active dot - ikonun üstünde */}
                        {isActive && (
                          <span className="pointer-events-none absolute -top-1.5 w-1 h-1 rounded-full bg-black shadow-sm dark:bg-white" />
                        )}
                        
                        {/* Icon wrapper */}
                        <span className="relative flex h-6 w-6 items-center justify-center overflow-visible">
                          <Icon className="h-6 w-6" />

                          {/* Cart badge */}
                          {tab.badge && (
                            <Badge
                              variant="default"
                              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] leading-none px-1"
                            >
                              {tab.badge}
                            </Badge>
                          )}
                        </span>

                        {/* Label */}
                        <span className="text-[10px] font-medium leading-none">
                          {tab.label}
                        </span>
                      </div>
                    </button>
                  );
                }

                // Diğer tab'lar için Link (href null değilse)
                if (!tab.href) return null;
                
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    scroll={false}
                    onClick={() => {
                      // Tab tıklamasında scroll kaydet + intent yaz
                      const fromTabId = getActiveTabId(pathname);
                      if (fromTabId) {
                        const el = document.querySelector('[data-scroll-container][data-active="true"]') as HTMLElement | null;
                        const y = el?.scrollTop ?? 0;
                        saveTabScroll(fromTabId, y);
                      }
                      setTabNavIntent({
                        fromTabId: fromTabId,
                        toTabId: tab.id,
                        ts: Date.now(),
                      });
                    }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-1 py-1 min-h-11",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "active:opacity-90",
                      isActive ? "text-black dark:text-white" : "text-gray-600 dark:text-white/70"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="relative flex flex-col items-center justify-center gap-1">
                      {/* Active dot - ikonun üstünde */}
                      {isActive && (
                        <span className="pointer-events-none absolute -top-1.5 w-1 h-1 rounded-full bg-black shadow-sm dark:bg-white" />
                      )}
                      
                      {/* Icon wrapper */}
                      <span className="relative flex h-6 w-6 items-center justify-center overflow-visible">
                        {tab.isAvatar && tab.user ? (
                          <Avatar className="h-6 w-6 ring-2 ring-border">
                            {tab.user.imageUrl && (
                              <AvatarImage
                                src={tab.user.imageUrl}
                                alt={tab.user.name || "User"}
                              />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(tab.user.name) || (
                                <Icons.user className="h-3 w-3" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <Icon className="h-6 w-6" />
                        )}

                        {/* Cart badge */}
                        {tab.badge && (
                          <Badge
                            variant="default"
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] leading-none px-1"
                          >
                            {tab.badge}
                          </Badge>
                        )}

                        {/* Profile dot badge */}
                        {tab.hasDot && (
                          <Badge
                            variant="dot"
                            className="absolute top-1 right-1"
                          />
                        )}
                      </span>

                      {/* Label */}
                      <span className="text-[10px] font-medium leading-none">
                        {tab.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
        </div>
      </nav>

      <DrawerContent className="rounded-t-2xl bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl border-t border-border/50">
        {/* ✅ Bu blok şart: CartView boş olsa bile Title DOM'da olacak */}
        <DrawerHeader className="sr-only px-4 pt-3">
          <DrawerTitle>Sepet</DrawerTitle>
          <DrawerDescription>Sepet çekmecesi</DrawerDescription>
        </DrawerHeader>
        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <CartView variant="drawer" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
