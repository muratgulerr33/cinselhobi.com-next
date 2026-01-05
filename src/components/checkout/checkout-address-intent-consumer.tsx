"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  peekCheckoutAddressIntent,
  consumeCheckoutAddressIntent,
} from "@/lib/checkout-intent";
import { addAddressAction } from "@/actions/address";
import { toast } from "sonner";

interface Address {
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault?: boolean;
}

/**
 * Adresleri normalize ederek karşılaştırır (duplicate kontrolü için)
 */
function normalizeAddress(address: Address): string {
  return JSON.stringify({
    title: address.title.trim().toLowerCase(),
    fullAddress: address.fullAddress.trim().toLowerCase(),
    city: address.city.trim().toLowerCase(),
    district: address.district.trim().toLowerCase(),
    phone: address.phone.replace(/\s+/g, "").toLowerCase(),
  });
}

/**
 * CheckoutAddressIntentConsumer
 * 
 * Auth sonrası checkout sayfasına dönüldüğünde intent'i tüketip
 * adresi otomatik ekler ve toast gösterir.
 */
interface CheckoutAddressIntentConsumerProps {
  existingAddresses?: Address[];
  onAddressAdded?: () => void;
  onDone?: () => void;
}

export function CheckoutAddressIntentConsumer({
  existingAddresses = [],
  onAddressAdded,
  onDone,
}: CheckoutAddressIntentConsumerProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Auth değilse hiçbir şey yapma
    if (!isAuthenticated) {
      return;
    }

    // Checkout sayfasında değilsek hiçbir şey yapma
    if (pathname !== "/checkout") {
      return;
    }

    // Intent'i oku (silmeden)
    const intent = peekCheckoutAddressIntent();
    if (!intent) {
      return;
    }

    // Aynı intent daha önce işlendi mi kontrol et (sessionStorage guard)
    const sessionKey = `ch:intent_processed:${intent.intentId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(sessionKey)) {
      // Zaten işlenmiş, intent'i temizle ve çık
      consumeCheckoutAddressIntent();
      return;
    }

    // Dedupe: Mevcut adreslerle karşılaştır
    const normalizedIntent = normalizeAddress(intent.address);
    const isDuplicate = existingAddresses.some((addr) => {
      const normalizedExisting = normalizeAddress(addr);
      return normalizedExisting === normalizedIntent;
    });

    if (isDuplicate) {
      // Zaten var, intent'i temizle ve çık
      consumeCheckoutAddressIntent();
      if (typeof window !== "undefined") {
        sessionStorage.setItem(sessionKey, "1");
      }
      return;
    }

    // Adresi ekle
    addAddressAction(intent.address)
      .then((result) => {
        if (result.ok) {
          // SessionStorage'a işaret koy (tekrar işlenmesin)
          if (typeof window !== "undefined") {
            sessionStorage.setItem(sessionKey, "1");
          }
          // Intent'i tüket (sil)
          consumeCheckoutAddressIntent();
          // Toast göster
          toast.success("Adresiniz eklendi.");
          // Callback'leri çağır
          if (onAddressAdded) {
            onAddressAdded();
          }
          if (onDone) {
            onDone();
          }
        } else {
          // Hata durumunda intent'i temizleme, tekrar deneme şansı ver
          console.error("[CheckoutAddressIntentConsumer] Adres ekleme hatası:", result.error);
          toast.error("Adres eklenirken bir hata oluştu. Lütfen tekrar deneyin.");
        }
      })
      .catch((error) => {
        console.error("[CheckoutAddressIntentConsumer] Beklenmeyen hata:", error);
        toast.error("Adres eklenirken bir hata oluştu.");
      });
  }, [isAuthenticated, pathname, existingAddresses, onAddressAdded, onDone]);

  // Bu component görsel bir şey render etmez
  return null;
}

