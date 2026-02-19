"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { getAgeVerified, setAgeVerified } from "@/lib/age-gate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { useIsHydrated } from "@/hooks/use-is-hydrated";

const MOBILE_BREAKPOINT = 640; // sm: <=640px → Drawer, >640px → Dialog

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function GateContent({
  onConfirm,
  onExit,
  primaryRef,
}: {
  onConfirm: () => void;
  onExit: () => void;
  primaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="space-y-2 text-center sm:text-left">
        <h2 id="age-gate-title" className="text-foreground text-xl font-semibold leading-none tracking-tight">
          Yaş doğrulama
        </h2>
        <p className="text-foreground/80 text-sm leading-relaxed">
          Bu site 18 yaş ve üzeri <span className="font-semibold">YETİŞKİN</span> kullanıcılar içindir.
          <br />
          Devam etmek için lütfen yaşınızı onaylayın.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-center text-sm text-foreground/75">
        <Info className="size-4 shrink-0 text-foreground/60" aria-hidden />
        18 yaşından küçükseniz lütfen siteden çıkın.
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onExit} type="button" className="border-border/60">
          Geri
        </Button>
        <div ref={primaryRef}>
          <Button onClick={onConfirm} type="button">
            18+ Devam Et
          </Button>
        </div>
      </div>
    </>
  );
}

const overlayBlurClass =
  "bg-black/70 supports-[backdrop-filter]:bg-black/60 backdrop-blur-xl";

export function AgeGate() {
  const hydrated = useIsHydrated();
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  const isMobile = useIsMobile();
  const primaryRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    const frame = requestAnimationFrame(() => {
      const isVerified = getAgeVerified();
      setOpen(!isVerified);
      setResolved(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [hydrated]);

  const handleConfirm = useCallback(() => {
    setAgeVerified();
    setOpen(false);
  }, []);

  const handleExit = useCallback(() => {
    if (typeof window === "undefined") return;
    const referrer = document.referrer;
    if (referrer && new URL(referrer).origin !== window.location.origin) {
      window.location.href = referrer;
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.replace("about:blank");
    }
  }, []);

  useEffect(() => {
    if (!resolved || !open) return;
    // İlk odak: primary CTA (Button ref kabul etmediği için wrapper içindeki butona odaklan)
    const t = setTimeout(() => {
      const btn = primaryRef.current?.querySelector?.("button");
      if (btn) (btn as HTMLButtonElement).focus();
    }, 100);
    return () => clearTimeout(t);
  }, [resolved, open]);

  if (!hydrated || !resolved || !open) return null;

  const sharedContent = (
    <GateContent onConfirm={handleConfirm} onExit={handleExit} primaryRef={primaryRef} />
  );

  // Mobil: fixed bottom sheet (no portal-side effects during hydration)
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[100]">
        <div className={cn("absolute inset-0 pointer-events-auto", overlayBlurClass)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          className={cn(
            "absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-background p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))]",
            "duration-200 motion-reduce:duration-0 animate-in slide-in-from-bottom"
          )}
        >
          <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-4 pt-4">
            <div className="space-y-2 p-0 text-center">
              <h2 id="age-gate-title" className="text-foreground text-xl font-semibold leading-none tracking-tight">
                Yaş doğrulama
              </h2>
              <p className="text-foreground/80 text-sm leading-relaxed">
                Bu site 18 yaş ve üzeri <span className="font-semibold">YETİŞKİN</span> kullanıcılar içindir.
                <br />
                Devam etmek için lütfen yaşınızı onaylayın.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-center text-sm text-foreground/75">
              <Info className="size-4 shrink-0 text-foreground/60" aria-hidden />
              18 yaşından küçükseniz lütfen siteden çıkın.
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <Button variant="outline" onClick={handleExit} type="button" className="w-full border-border/60">
                Geri
              </Button>
              <div ref={primaryRef} className="w-full">
                <Button onClick={handleConfirm} type="button" className="w-full">
                  18+ Devam Et
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: fixed centered dialog (no portal-side effects during hydration)
  return (
    <div className="fixed inset-0 z-[100]">
      <div className={cn("absolute inset-0 pointer-events-auto", overlayBlurClass)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        className={cn(
          "absolute left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-lg",
          "duration-200 motion-reduce:duration-0 animate-in fade-in-0 zoom-in-95"
        )}
      >
        {sharedContent}
      </div>
    </div>
  );
}
