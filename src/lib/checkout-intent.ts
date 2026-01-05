/**
 * Checkout Address Intent Utility
 * 
 * Guest kullanıcı checkout'ta adres eklemeye çalıştığında, adres bilgisini
 * localStorage'da saklar. Auth sonrası bu intent tüketilip adres otomatik eklenir.
 */

export interface CheckoutAddressIntent {
  intentId: string;
  address: {
    title: string;
    fullAddress: string;
    city: string;
    district: string;
    phone: string;
    isDefault?: boolean;
  };
  returnUrl: string; // relative path: "/checkout"
  createdAt: number; // timestamp
}

const INTENT_KEY = "checkout_address_intent";
const TTL_MS = 15 * 60 * 1000; // 15 dakika

/**
 * Intent ID üretir
 */
function generateIntentId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Intent'i localStorage'a yazar
 */
export function saveCheckoutAddressIntent(
  address: CheckoutAddressIntent["address"],
  returnUrl: string = "/checkout"
): string {
  try {
    const intentId = generateIntentId();
    const intent: CheckoutAddressIntent = {
      intentId,
      address,
      returnUrl,
      createdAt: Date.now(),
    };
    localStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    return intentId;
  } catch (error) {
    console.error("[saveCheckoutAddressIntent] localStorage yazma hatası:", error);
    return "";
  }
}

/**
 * Intent'i localStorage'dan okur (silmeden)
 * @returns Intent varsa ve geçerliyse intent, yoksa null
 */
export function peekCheckoutAddressIntent(): CheckoutAddressIntent | null {
  try {
    const stored = localStorage.getItem(INTENT_KEY);
    if (!stored) {
      return null;
    }

    const intent: CheckoutAddressIntent = JSON.parse(stored);
    const now = Date.now();
    const age = now - intent.createdAt;

    // TTL kontrolü: 15 dakikadan eski intent'leri ignore et
    if (age > TTL_MS) {
      localStorage.removeItem(INTENT_KEY);
      return null;
    }

    return intent;
  } catch (error) {
    console.error("[peekCheckoutAddressIntent] localStorage okuma hatası:", error);
    return null;
  }
}

/**
 * Intent'i localStorage'dan siler (başarıyla işlendiğinde)
 */
export function consumeCheckoutAddressIntent(): void {
  try {
    localStorage.removeItem(INTENT_KEY);
  } catch (error) {
    console.error("[consumeCheckoutAddressIntent] localStorage silme hatası:", error);
  }
}

