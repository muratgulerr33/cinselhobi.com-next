const SCROLL_KEY_PREFIX = '__tabScroll:';
const INTENT_KEY = '__tabNavIntent';

export type TabId = 'home' | 'categories' | 'wishlist' | 'profile';

export interface TabNavIntent {
  fromTabId: string | null;
  toTabId: string;
  ts: number;
}

/**
 * Tab'ın scroll pozisyonunu kaydeder
 */
export function saveTabScroll(tabId: string, y: number): void {
  try {
    sessionStorage.setItem(SCROLL_KEY_PREFIX + tabId, String(y));
  } catch (e) {
    // Private mode veya storage hatası - sessizce yut
  }
}

/**
 * Tab'ın kaydedilmiş scroll pozisyonunu okur
 */
export function readTabScroll(tabId: string): number {
  try {
    const value = sessionStorage.getItem(SCROLL_KEY_PREFIX + tabId);
    if (value === null) return 0;
    const y = Number(value);
    return isNaN(y) ? 0 : y;
  } catch (e) {
    return 0;
  }
}

/**
 * Tab navigasyon intent'ini kaydeder
 */
export function setTabNavIntent(payload: TabNavIntent): void {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(payload));
  } catch (e) {
    // Private mode veya storage hatası - sessizce yut
  }
}

/**
 * Tab navigasyon intent'ini okur ve siler
 * @param maxAgeMs Intent'in maksimum yaşı (milisaniye)
 */
export function consumeTabNavIntent(maxAgeMs: number = 2000): TabNavIntent | null {
  try {
    const value = sessionStorage.getItem(INTENT_KEY);
    if (value === null) return null;

    const intent: TabNavIntent = JSON.parse(value);
    const age = Date.now() - intent.ts;

    // Eski intent'leri yok say
    if (age > maxAgeMs) {
      sessionStorage.removeItem(INTENT_KEY);
      return null;
    }

    // Intent'i oku ve sil
    sessionStorage.removeItem(INTENT_KEY);
    return intent;
  } catch (e) {
    // Parse hatası veya storage hatası
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

