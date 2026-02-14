"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { Portal, Overlay, Content as VaulContent } from "vaul";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { getAgeVerified, setAgeVerified } from "@/lib/age-gate";
import {
  Drawer,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

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
      <DialogHeader className="space-y-2 text-center sm:text-left">
        <DialogTitle className="text-foreground text-xl">
          Yaş doğrulama
        </DialogTitle>
        <DialogDescription className="text-foreground/80 text-sm leading-relaxed">
          Bu site 18 yaş ve üzeri <span className="font-semibold">YETİŞKİN</span> kullanıcılar içindir.
          <br />
          Devam etmek için lütfen yaşınızı onaylayın.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-center text-sm text-foreground/75">
        <Info className="size-4 shrink-0 text-foreground/60" aria-hidden />
        18 yaşından küçükseniz lütfen siteden çıkın.
      </div>
      <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onExit} type="button" className="border-border/60">
          Geri
        </Button>
        <div ref={primaryRef}>
          <Button onClick={onConfirm} type="button">
            18+ Devam Et
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

const overlayBlurClass =
  "bg-black/70 supports-[backdrop-filter]:bg-black/60 backdrop-blur-xl";

export function AgeGate() {
  const [verified, setVerified] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const primaryRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tick = () => {
      setVerified(getAgeVerified());
      setMounted(true);
    };
    const t = setTimeout(tick, 0);
    return () => clearTimeout(t);
  }, []);

  const handleConfirm = useCallback(() => {
    setAgeVerified();
    setVerified(true);
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
    if (!mounted || verified) return;
    // İlk odak: primary CTA (Button ref kabul etmediği için wrapper içindeki butona odaklan)
    const t = setTimeout(() => {
      const btn = primaryRef.current?.querySelector?.("button");
      if (btn) (btn as HTMLButtonElement).focus();
    }, 100);
    return () => clearTimeout(t);
  }, [mounted, verified]);

  if (!mounted || verified) return null;

  const sharedContent = (
    <GateContent onConfirm={handleConfirm} onExit={handleExit} primaryRef={primaryRef} />
  );

  // Mobil: Drawer (Vaul), dismissible=false
  if (isMobile) {
    return (
      <Drawer open onOpenChange={() => {}} dismissible={false}>
        <Portal>
          <Overlay
            className={cn(
              "fixed inset-0 z-[100] border-0",
              overlayBlurClass
            )}
          />
          <VaulContent
            className={cn(
              "fixed inset-x-0 bottom-0 z-[100] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-background p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))]",
              "duration-200 motion-reduce:duration-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
            )}
          >
            <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
            <div className="flex flex-1 flex-col gap-4 pt-4">
              <DrawerHeader className="space-y-2 p-0 text-center">
                <DrawerTitle className="text-foreground text-xl font-semibold leading-none tracking-tight">
                  Yaş doğrulama
                </DrawerTitle>
                <DrawerDescription className="text-foreground/80 text-sm leading-relaxed">
                  Bu site 18 yaş ve üzeri <span className="font-semibold">YETİŞKİN</span> kullanıcılar içindir.
                  <br />
                  Devam etmek için lütfen yaşınızı onaylayın.
                </DrawerDescription>
              </DrawerHeader>
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
          </VaulContent>
        </Portal>
      </Drawer>
    );
  }

  // Desktop: Dialog, outside/ESC kapatılamaz
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            "fixed inset-0 z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            overlayBlurClass
          )}
        />
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            "fixed left-[50%] top-[50%] z-[100] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:duration-0"
          )}
        >
          {sharedContent}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
