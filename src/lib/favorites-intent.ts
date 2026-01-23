/**
 * Favorite Intent Utility
 * 
 * Guest kullanıcı kalp ikonuna bastığında, hangi ürünü favorilere eklemek istediğini
 * ve nereden geldiğini localStorage'da saklar. Auth sonrası bu intent tüketilir.
 */

export interface FavoriteIntent {
  productId: number;
  from: string; // relative path: pathname + search + hash
  createdAt: number; // timestamp
}

const INTENT_KEY = "favorite_intent";
const TTL_MS = 15 * 60 * 1000; // 15 dakika

/**
 * Intent'i localStorage'a yazar
 */
export function saveFavoriteIntent(intent: FavoriteIntent): void {
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch (error) {
    console.error("[saveFavoriteIntent] localStorage yazma hatası:", error);
  }
}

/**
 * Intent'i localStorage'dan okur ve TTL kontrolü yapar
 * @returns Intent varsa ve geçerliyse intent, yoksa null
 */
export function getFavoriteIntent(): FavoriteIntent | null {
  try {
    const stored = localStorage.getItem(INTENT_KEY);
    if (!stored) {
      return null;
    }

    const intent: FavoriteIntent = JSON.parse(stored);
    const now = Date.now();
    const age = now - intent.createdAt;

    // TTL kontrolü: 15 dakikadan eski intent'leri ignore et
    if (age > TTL_MS) {
      localStorage.removeItem(INTENT_KEY);
      return null;
    }

    return intent;
  } catch (error) {
    console.error("[getFavoriteIntent] localStorage okuma hatası:", error);
    return null;
  }
}

/**
 * Intent'i localStorage'dan siler (başarıyla işlendiğinde)
 */
export function consumeFavoriteIntent(): void {
  try {
    localStorage.removeItem(INTENT_KEY);
  } catch (error) {
    console.error("[consumeFavoriteIntent] localStorage silme hatası:", error);
  }
}

