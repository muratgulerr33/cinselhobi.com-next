"use client";

import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface LiveSupportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LiveSupportDrawer({ open, onOpenChange }: LiveSupportDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="space-y-1 text-left">
          <DrawerTitle>Canlı Destek</DrawerTitle>
          <DrawerDescription>Hızlıca ulaşın — WhatsApp veya telefon</DrawerDescription>
        </DrawerHeader>

        <div className="mt-1 px-4 pb-5 pt-2">
          <div className="mt-4 grid gap-3">
            <Button asChild className="h-12 w-full rounded-full px-4 font-semibold">
              <a
                href="https://wa.me/905458651215"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp ile canlı destek"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp ile Yaz
              </a>
            </Button>

            <Button asChild variant="outline" className="h-12 w-full rounded-full px-4 font-semibold">
              <a href="tel:+905458651215" aria-label="Telefonla hemen ara">
                <Phone className="h-4 w-4" />
                Hemen Ara
              </a>
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">Yanıt süremiz genelde birkaç dakikadır.</p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
