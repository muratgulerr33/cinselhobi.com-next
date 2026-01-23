"use client";

import { useEffect, startTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getCheckoutAddressIntent, consumeCheckoutAddressIntent } from "@/lib/checkout-address-intent";
import { addAddressAction } from "@/actions/address";

/**
 * CheckoutAddressIntentConsumer
 * 
 * Auth sonrası /checkout'a geri dönüldüğünde intent'i tüketip
 * adresi ekler ve sayfayı yeniler.
 */
interface CheckoutAddressIntentConsumerProps {
  onApplied?: () => void | Promise<void>;
}

export function CheckoutAddressIntentConsumer({ onApplied }: CheckoutAddressIntentConsumerProps) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Status authenticated olmadan intent işleme
    if (status !== "authenticated") {
      return;
    }

    // Intent'i peek et (duplicate kontrolü için)
    const intent = getCheckoutAddressIntent();
    if (!intent) {
      return;
    }

    // Intent.from kontrolü: sadece "/checkout" ile karşılaştır
    if (intent.from !== "/checkout") {
      return;
    }

    // Duplicate engelleme: lockKey oluştur (intent.id yok, createdAt kullan)
    const lockKey = `checkout_address_intent_lock:${intent.createdAt}`;
    
    // Eğer bu intent zaten işleniyorsa/işlendiyse return
    if (sessionStorage.getItem(lockKey)) {
      return;
    }

    // Lock'u set et (addAddressAction'dan ÖNCE)
    sessionStorage.setItem(lockKey, "1");

    // Adresi ekle
    addAddressAction({
      title: intent.title,
      fullAddress: intent.fullAddress,
      city: intent.city,
      district: intent.district,
      phone: intent.phone,
      isDefault: intent.isDefault,
    })
      .then(async (result) => {
        if (result.ok) {
          // Başarılı olunca consume et
          consumeCheckoutAddressIntent();
          
          // onApplied callback'ini çağır (adres listesini anında güncellemek için)
          await onApplied?.();
          
          // (Opsiyonel) router.refresh() kalsın ama asıl güncelleme onApplied
          startTransition(() => {
            router.refresh();
          });
        } else {
          // Başarısız olursa lock'u kaldır (retry edebilsin)
          sessionStorage.removeItem(lockKey);
          
          if (result.error === "Unauthorized") {
            // Unauthorized ise intent'i consume etme (localStorage'da kalsın)
            return;
          }
        }
      })
      .catch((error) => {
        // Hata durumunda lock'u kaldır (retry edebilsin)
        sessionStorage.removeItem(lockKey);
        console.error("[CheckoutAddressIntentConsumer] Adres ekleme hatası:", error);
      });
  }, [status, onApplied, router]);

  // Bu component görsel bir şey render etmez
  return null;
}
