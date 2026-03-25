"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  getTawkSuppressionSources,
  subscribeToTawkSuppression,
} from "@/components/integrations/tawk/tawk-visibility";

declare global {
  interface Window {
    Tawk_API?: {
      hideWidget?: () => void;
      showWidget?: () => void;
      onLoad?: () => void;
    };
    Tawk_LoadStart?: Date;
  }
}

const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID?.trim();
const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID?.trim();

function isHiddenRoute(pathname: string) {
  return (
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/order-success/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export function TawkWidgetBoot() {
  const pathname = usePathname();
  const hiddenRoute = isHiddenRoute(pathname);
  const [hasBooted, setHasBooted] = useState(false);
  const [isWidgetLoaded, setIsWidgetLoaded] = useState(false);
  const [suppressionCount, setSuppressionCount] = useState(() => getTawkSuppressionSources().size);
  const hiddenRef = useRef(hiddenRoute);
  const visibilityRef = useRef<"hidden" | "shown" | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const shouldRenderScript = hasBooted || !hiddenRoute;
  const hidden = hiddenRoute || suppressionCount > 0;

  useEffect(() => {
    return subscribeToTawkSuppression((sources) => {
      setSuppressionCount(sources.size);
    });
  }, []);

  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  useEffect(() => {
    if (!shouldRenderScript || typeof window === "undefined") {
      return;
    }

    const api = window.Tawk_API ?? {};
    const handleWidgetLoad = () => {
      setIsWidgetLoaded(true);
    };

    api.onLoad = handleWidgetLoad;
    window.Tawk_API = api;

    return () => {
      if (window.Tawk_API?.onLoad === handleWidgetLoad) {
        window.Tawk_API.onLoad = undefined;
      }
    };
  }, [shouldRenderScript]);

  useEffect(() => {
    if (!shouldRenderScript || !isWidgetLoaded || typeof window === "undefined") {
      return;
    }

    const syncVisibility = (attempt = 0) => {
      const api = window.Tawk_API;
      const nextVisibility = hiddenRef.current ? "hidden" : "shown";
      const action = hiddenRef.current ? api?.hideWidget : api?.showWidget;

      if (typeof action !== "function") {
        if (attempt < 10) {
          retryTimeoutRef.current = window.setTimeout(() => {
            syncVisibility(attempt + 1);
          }, 100);
        }
        return;
      }

      if (visibilityRef.current === nextVisibility) {
        return;
      }

      action.call(api);
      visibilityRef.current = nextVisibility;
    };

    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    syncVisibility();

    return () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [hidden, isWidgetLoaded, shouldRenderScript]);

  if (!propertyId || !widgetId) {
    return null;
  }

  if (!shouldRenderScript) {
    return null;
  }

  return (
    <>
      <Script id="tawk-widget-stub" strategy="afterInteractive">
        {`
          window.Tawk_API = window.Tawk_API || {};
          window.Tawk_LoadStart = new Date();
        `}
      </Script>
      <Script
        id="tawk-widget-script"
        src={`https://embed.tawk.to/${propertyId}/${widgetId}`}
        strategy="afterInteractive"
        onLoad={() => {
          setHasBooted(true);
          setIsWidgetLoaded(true);
        }}
        onError={() => {
          console.warn("[tawk] Widget script failed to load.");
        }}
      />
    </>
  );
}
