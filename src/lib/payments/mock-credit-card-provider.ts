"use client";

import type { PaymentProvider, PaymentResult } from "./payment-provider";

/**
 * Mock Credit Card Provider
 * 
 * Development/local ortamında kredi kartı ödemelerini simüle eder.
 * Test senaryosu UI'dan seçilir (success/fail/3ds).
 */
export class MockCreditCardProvider implements PaymentProvider {
  private testScenario: "success" | "fail" | "threeDSRequired";

  constructor(testScenario: "success" | "fail" | "threeDSRequired" = "success") {
    this.testScenario = testScenario;
  }

  async startPayment(_params: {
    amount: number;
    orderDraftId?: string;
  }): Promise<PaymentResult> {
    // Simüle edilmiş network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    switch (this.testScenario) {
      case "success":
        return { type: "success" };

      case "fail":
        return {
          type: "fail",
          error: "Kartınız yetersiz bakiye nedeniyle reddedildi",
        };

      case "threeDSRequired":
        return {
          type: "threeDSRequired",
          challengeUrl: undefined, // Mock için URL gerekmez
        };

      default:
        return {
          type: "fail",
          error: "Bilinmeyen test senaryosu",
        };
    }
  }
}
