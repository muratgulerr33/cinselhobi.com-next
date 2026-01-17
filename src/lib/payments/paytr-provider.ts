import type { PaymentProvider, PaymentResult } from "./payment-provider";
import crypto from "crypto";

/**
 * PayTR Payment Provider
 * 
 * PayTR ödeme gateway entegrasyonu için provider.
 * ENV değişkenleri:
 * - PAYTR_MERCHANT_ID
 * - PAYTR_MERCHANT_KEY
 * - PAYTR_MERCHANT_SALT
 */
export class PayTRProvider implements PaymentProvider {
  private merchantId: string | undefined;
  private merchantKey: string | undefined;
  private merchantSalt: string | undefined;

  constructor() {
    this.merchantId = process.env.PAYTR_MERCHANT_ID;
    this.merchantKey = process.env.PAYTR_MERCHANT_KEY;
    this.merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  }

  /**
   * PayTR konfigürasyonunun tamamlanıp tamamlanmadığını kontrol eder
   */
  isConfigured(): boolean {
    return !!(
      this.merchantId &&
      this.merchantKey &&
      this.merchantSalt &&
      this.merchantId.trim() !== "" &&
      this.merchantKey.trim() !== "" &&
      this.merchantSalt.trim() !== ""
    );
  }

  /**
   * Kredi kartı ödemesi için PayTR iFrame token'ı alır
   * 
   * @param params Ödeme parametreleri
   * @returns iframe_token veya hata
   */
  async startCardPayment(params: {
    amount: number; // Kuruş cinsinden
    merchantOid: string; // Order reference (orderId veya orderRef)
    userIp: string; // Kullanıcı IP adresi
    email: string; // Müşteri email
    userBasket: string; // Base64 encoded JSON basket
    userName?: string; // Müşteri adı (opsiyonel)
    userAddress?: string; // Müşteri adresi (opsiyonel)
    userPhone?: string; // Müşteri telefonu (opsiyonel)
    noInstallment?: number; // Taksit gösterilmesin (1) veya gösterilsin (0), default: 0
    maxInstallment?: number; // Max taksit sayısı (0-12), default: 0
    currency?: string; // Para birimi, default: "TL"
    testMode?: number; // Test modu (1) veya canlı (0), default: 0
  }): Promise<{ success: true; iframeToken: string } | { success: false; error: string }> {
    // İlk satır: yapılandırma kontrolü - fetch yapmadan dön
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Kredi kartı ödeme henüz aktif değil",
      };
    }

    if (!this.merchantId || !this.merchantKey || !this.merchantSalt) {
      return {
        success: false,
        error: "PayTR credentials eksik",
      };
    }

    try {
      // PayTR get-token endpoint parametreleri
      const merchantId = this.merchantId;
      const userIp = params.userIp;
      const merchantOid = params.merchantOid;
      const email = params.email;
      const paymentAmount = params.amount;
      const userBasket = params.userBasket;
      const noInstallment = params.noInstallment ?? 0;
      const maxInstallment = params.maxInstallment ?? 0;
      const currency = params.currency ?? "TL";
      const testMode = params.testMode ?? 0;

      // Hash string oluştur (PayTR dokümantasyonuna göre sıralama önemli)
      const hashStr =
        merchantId +
        userIp +
        merchantOid +
        email +
        paymentAmount +
        userBasket +
        noInstallment +
        maxInstallment +
        currency +
        testMode;

      // PayTR token hesapla (HMAC-SHA256 + base64)
      const paytrToken = crypto
        .createHmac("sha256", this.merchantKey)
        .update(hashStr + this.merchantSalt)
        .digest("base64");

      // POST body oluştur
      const formData = new URLSearchParams();
      formData.append("merchant_id", merchantId);
      formData.append("user_ip", userIp);
      formData.append("merchant_oid", merchantOid);
      formData.append("email", email);
      formData.append("payment_amount", paymentAmount.toString());
      formData.append("user_basket", userBasket);
      formData.append("no_installment", noInstallment.toString());
      formData.append("max_installment", maxInstallment.toString());
      formData.append("currency", currency);
      formData.append("paytr_token", paytrToken);
      formData.append("test_mode", testMode.toString());

      // Opsiyonel alanlar
      if (params.userName) {
        formData.append("user_name", params.userName);
      }
      if (params.userAddress) {
        formData.append("user_address", params.userAddress);
      }
      if (params.userPhone) {
        formData.append("user_phone", params.userPhone);
      }

      // Callback URL (opsiyonel, merchant panel'de de ayarlanabilir)
      const baseUrl =
        process.env.AUTH_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "https://cinselhobi.com";
      const callbackUrl = `${baseUrl}/api/payments/paytr/callback`;
      formData.append("merchant_ok_url", callbackUrl);
      formData.append("merchant_fail_url", callbackUrl);

      // PayTR API'ye POST isteği gönder
      const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const responseData = await response.json();

      if (responseData.status === "success" && responseData.token) {
        return {
          success: true,
          iframeToken: responseData.token,
        };
      } else {
        const errorMessage =
          responseData.reason || "PayTR token alınamadı";
        console.error("[PayTRProvider] Token alma hatası:", errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Bilinmeyen hata";
      console.error("[PayTRProvider] startCardPayment hatası:", errorMessage);
      return {
        success: false,
        error: `PayTR bağlantı hatası: ${errorMessage}`,
      };
    }
  }

  /**
   * Ödeme işlemini başlatır
   * 
   * NOT: Bu metod eski interface'i desteklemek için bırakılmıştır.
   * Yeni kod startCardPayment() kullanmalıdır.
   */
  async startPayment(params: {
    amount: number;
    orderDraftId?: string;
  }): Promise<PaymentResult> {
    // ENV kontrolü
    if (!this.isConfigured()) {
      return {
        type: "fail",
        error: "PayTR ödeme sistemi şu anda yapılandırılmamış. Lütfen daha sonra tekrar deneyin.",
      };
    }

    // Eski interface için skeleton response
    return {
      type: "threeDSRequired",
      challengeUrl: undefined,
    };
  }
}
