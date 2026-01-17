/**
 * Payment Provider Interface
 * 
 * Farklı ödeme altyapılarını (Mock, PayTR, vb.) tek tip çağırmak için abstraction.
 */

export type PaymentResult =
  | { type: "success" }
  | { type: "fail"; error: string }
  | { type: "threeDSRequired"; challengeUrl?: string };

export interface PaymentProvider {
  /**
   * Ödeme işlemini başlatır
   * @param params Ödeme parametreleri
   * @returns Ödeme sonucu
   */
  startPayment(params: {
    amount: number; // Kuruş cinsinden
    orderDraftId?: string; // Opsiyonel: draft order ID
  }): Promise<PaymentResult>;
}
