#!/usr/bin/env node
/**
 * Email template preview script
 * Usage: node scripts/email-preview.ts <template-name>
 * Example: node scripts/email-preview.ts order-confirmation-customer
 */

import * as authWelcome from "../src/lib/email/templates/auth-welcome";
import * as authVerifyEmail from "../src/lib/email/templates/auth-verify-email";
import * as authResetPassword from "../src/lib/email/templates/auth-reset-password";
import * as authPasswordChanged from "../src/lib/email/templates/auth-password-changed";
import * as authLoginAlert from "../src/lib/email/templates/auth-login-alert";
import * as orderConfirmationCustomer from "../src/lib/email/templates/order-confirmation-customer";
import * as orderNotificationAdmin from "../src/lib/email/templates/order-notification-admin";
import * as orderStatusProcessing from "../src/lib/email/templates/order-status-processing";
import * as orderStatusShipped from "../src/lib/email/templates/order-status-shipped";
import * as orderStatusDelivered from "../src/lib/email/templates/order-status-delivered";
import * as orderCancelled from "../src/lib/email/templates/order-cancelled";
import * as orderPaymentFailed from "../src/lib/email/templates/order-payment-failed";
import * as orderRefundInitiated from "../src/lib/email/templates/order-refund-initiated";
import * as supportContactReceivedCustomer from "../src/lib/email/templates/support-contact-received-customer";
import * as supportContactNotifyAdmin from "../src/lib/email/templates/support-contact-notify-admin";

import type { BaseEmailData, Order } from "../src/lib/email/templates/_types";
import type { LoginAlertData } from "../src/lib/email/templates/auth-login-alert";
import type { OrderConfirmationData } from "../src/lib/email/templates/order-confirmation-customer";
import type { OrderNotificationAdminData } from "../src/lib/email/templates/order-notification-admin";
import type { OrderStatusProcessingData } from "../src/lib/email/templates/order-status-processing";
import type { OrderStatusShippedData } from "../src/lib/email/templates/order-status-shipped";
import type { OrderStatusDeliveredData } from "../src/lib/email/templates/order-status-delivered";
import type { OrderCancelledData } from "../src/lib/email/templates/order-cancelled";
import type { OrderPaymentFailedData } from "../src/lib/email/templates/order-payment-failed";
import type { OrderRefundInitiatedData } from "../src/lib/email/templates/order-refund-initiated";
import type { SupportContactReceivedData } from "../src/lib/email/templates/support-contact-received-customer";
import type { SupportContactNotifyAdminData } from "../src/lib/email/templates/support-contact-notify-admin";

// Dummy data generators
function getBaseData(): BaseEmailData {
  return {
    customer: {
      firstName: "Ahmet",
      lastName: "Yılmaz",
      email: "ahmet@example.com",
    },
    brand: {
      fromNameDefault: "CinselHobi",
      supportEmail: "destek@cinselhobi.com",
      logoUrl: "https://cinselhobi.com/logo.svg",
    },
    links: {
      accountUrl: "https://cinselhobi.com/account",
      orderUrl: "https://cinselhobi.com/account/orders/123",
      supportUrl: "https://cinselhobi.com/support",
      verifyEmailUrl: "https://cinselhobi.com/verify?token=abc123",
      resetPasswordUrl: "https://cinselhobi.com/reset-password?token=xyz789",
      trackingUrl: "https://kargo.com/track/TRACK123",
    },
  };
}

function getOrderData(): Order {
  return {
    id: "12345",
    createdAt: "2025-01-15 14:30:00",
    total: 29900, // 299.00 TRY in cents
    currency: "TRY",
    itemsCount: 3,
    status: "pending",
    shortAddress: {
      city: "İstanbul",
      district: "Kadıköy",
    },
  };
}

// Template registry
const templates: Record<
  string,
  {
    subject: (data: any) => string;
    html: (data: any) => string;
    text: (data: any) => string;
    getData: () => any;
  }
> = {
  "auth-welcome": {
    subject: authWelcome.subject,
    html: authWelcome.html,
    text: authWelcome.text,
    getData: () => getBaseData(),
  },
  "auth-verify-email": {
    subject: authVerifyEmail.subject,
    html: authVerifyEmail.html,
    text: authVerifyEmail.text,
    getData: () => getBaseData(),
  },
  "auth-reset-password": {
    subject: authResetPassword.subject,
    html: authResetPassword.html,
    text: authResetPassword.text,
    getData: () => getBaseData(),
  },
  "auth-password-changed": {
    subject: authPasswordChanged.subject,
    html: authPasswordChanged.html,
    text: authPasswordChanged.text,
    getData: () => getBaseData(),
  },
  "auth-login-alert": {
    subject: authLoginAlert.subject,
    html: authLoginAlert.html,
    text: authLoginAlert.text,
    getData: (): LoginAlertData => ({
      ...getBaseData(),
      loginTime: "2025-01-15 14:30:00",
      ipAddress: "192.168.1.1",
      deviceInfo: "Chrome on Windows",
    }),
  },
  "order-confirmation-customer": {
    subject: orderConfirmationCustomer.subject,
    html: orderConfirmationCustomer.html,
    text: orderConfirmationCustomer.text,
    getData: (): OrderConfirmationData => ({
      ...getBaseData(),
      order: getOrderData(),
    }),
  },
  "order-notification-admin": {
    subject: orderNotificationAdmin.subject,
    html: orderNotificationAdmin.html,
    text: orderNotificationAdmin.text,
    getData: (): OrderNotificationAdminData => ({
      ...getBaseData(),
      order: getOrderData(),
    }),
  },
  "order-status-processing": {
    subject: orderStatusProcessing.subject,
    html: orderStatusProcessing.html,
    text: orderStatusProcessing.text,
    getData: (): OrderStatusProcessingData => ({
      ...getBaseData(),
      order: getOrderData(),
    }),
  },
  "order-status-shipped": {
    subject: orderStatusShipped.subject,
    html: orderStatusShipped.html,
    text: orderStatusShipped.text,
    getData: (): OrderStatusShippedData => ({
      ...getBaseData(),
      order: getOrderData(),
    }),
  },
  "order-status-delivered": {
    subject: orderStatusDelivered.subject,
    html: orderStatusDelivered.html,
    text: orderStatusDelivered.text,
    getData: (): OrderStatusDeliveredData => ({
      ...getBaseData(),
      order: getOrderData(),
    }),
  },
  "order-cancelled": {
    subject: orderCancelled.subject,
    html: orderCancelled.html,
    text: orderCancelled.text,
    getData: (): OrderCancelledData => ({
      ...getBaseData(),
      order: getOrderData(),
      reason: "Müşteri talebi",
    }),
  },
  "order-payment-failed": {
    subject: orderPaymentFailed.subject,
    html: orderPaymentFailed.html,
    text: orderPaymentFailed.text,
    getData: (): OrderPaymentFailedData => ({
      ...getBaseData(),
      order: getOrderData(),
    }),
  },
  "order-refund-initiated": {
    subject: orderRefundInitiated.subject,
    html: orderRefundInitiated.html,
    text: orderRefundInitiated.text,
    getData: (): OrderRefundInitiatedData => ({
      ...getBaseData(),
      order: getOrderData(),
      refundAmount: 29900,
    }),
  },
  "support-contact-received-customer": {
    subject: supportContactReceivedCustomer.subject,
    html: supportContactReceivedCustomer.html,
    text: supportContactReceivedCustomer.text,
    getData: (): SupportContactReceivedData => ({
      ...getBaseData(),
      ticketId: "TICKET-12345",
      subject: "Ürün sorusu",
    }),
  },
  "support-contact-notify-admin": {
    subject: supportContactNotifyAdmin.subject,
    html: supportContactNotifyAdmin.html,
    text: supportContactNotifyAdmin.text,
    getData: (): SupportContactNotifyAdminData => ({
      ...getBaseData(),
      ticketId: "TICKET-12345",
      subject: "Ürün sorusu",
      message: "Merhaba, ürün hakkında bilgi almak istiyorum.",
    }),
  },
};

// Main execution
function main() {
  // EPIPE fix: process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0) })
  process.stdout.on('error', (e) => {
    if (e.code === 'EPIPE') process.exit(0);
  });

  const templateName = process.argv[2];

  if (!templateName) {
    console.error("Kullanım: node scripts/email-preview.ts <template-name>");
    console.error("\nMevcut template'ler:");
    console.error(Object.keys(templates).join(", "));
    process.exit(1);
  }

  const template = templates[templateName];

  if (!template) {
    console.error(`Template bulunamadı: ${templateName}`);
    console.error("\nMevcut template'ler:");
    console.error(Object.keys(templates).join(", "));
    process.exit(1);
  }

  const data = template.getData();

  console.log("=".repeat(80));
  console.log(`Template: ${templateName}`);
  console.log("=".repeat(80));
  console.log("\nSUBJECT:");
  console.log("-".repeat(80));
  console.log(template.subject(data));
  console.log("\nHTML:");
  console.log("-".repeat(80));
  console.log(template.html(data));
  console.log("\nTEXT:");
  console.log("-".repeat(80));
  console.log(template.text(data));
  console.log("\n" + "=".repeat(80));
}

main();

