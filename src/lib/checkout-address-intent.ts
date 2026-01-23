/**
 * Checkout Address Intent Utility
 * 
 * Guest kullanıcı checkout'ta adres eklemek istediğinde, adres bilgilerini
 * ve nereden geldiğini localStorage'da saklar. Auth sonrası bu intent tüketilir.
 */

export interface CheckoutAddressIntent {
  title: string;
  fullAddress: string;
  city: string;
  district: string;
  phone: string;
  isDefault?: boolean;
  from: string; // relative path: pathname + search + hash
  createdAt: number; // timestamp
}

const INTENT_KEY = "checkout_address_intent";
const TTL_MS = 15 * 60 * 1000; // 15 dakika

/**
 * Intent'i localStorage'a yazar
 */
export function saveCheckoutAddressIntent(intent: CheckoutAddressIntent): void {
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch (error) {
    console.error("[saveCheckoutAddressIntent] localStorage yazma hatası:", error);
  }
}

/**
 * Intent'i localStorage'dan okur ve TTL kontrolü yapar
 * @returns Intent varsa ve geçerliyse intent, yoksa null
 */
export function getCheckoutAddressIntent(): CheckoutAddressIntent | null {
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
    console.error("[getCheckoutAddressIntent] localStorage okuma hatası:", error);
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
