/**
 * Email templates export index
 * All templates export: subject(data), html(data), text(data)
 */

// Auth templates
export {
  subject as authWelcomeSubject,
  html as authWelcomeHtml,
  text as authWelcomeText,
} from "./auth-welcome";
export {
  subject as authVerifyEmailSubject,
  html as authVerifyEmailHtml,
  text as authVerifyEmailText,
} from "./auth-verify-email";
export {
  subject as authResetPasswordSubject,
  html as authResetPasswordHtml,
  text as authResetPasswordText,
} from "./auth-reset-password";
export {
  subject as authPasswordChangedSubject,
  html as authPasswordChangedHtml,
  text as authPasswordChangedText,
} from "./auth-password-changed";
export {
  subject as authLoginAlertSubject,
  html as authLoginAlertHtml,
  text as authLoginAlertText,
} from "./auth-login-alert";

// Order templates
export {
  subject as orderConfirmationCustomerSubject,
  html as orderConfirmationCustomerHtml,
  text as orderConfirmationCustomerText,
} from "./order-confirmation-customer";
export {
  subject as orderNotificationAdminSubject,
  html as orderNotificationAdminHtml,
  text as orderNotificationAdminText,
} from "./order-notification-admin";
export {
  subject as orderStatusProcessingSubject,
  html as orderStatusProcessingHtml,
  text as orderStatusProcessingText,
} from "./order-status-processing";
export {
  subject as orderStatusShippedSubject,
  html as orderStatusShippedHtml,
  text as orderStatusShippedText,
} from "./order-status-shipped";
export {
  subject as orderStatusDeliveredSubject,
  html as orderStatusDeliveredHtml,
  text as orderStatusDeliveredText,
} from "./order-status-delivered";
export {
  subject as orderCancelledSubject,
  html as orderCancelledHtml,
  text as orderCancelledText,
} from "./order-cancelled";
export {
  subject as orderPaymentFailedSubject,
  html as orderPaymentFailedHtml,
  text as orderPaymentFailedText,
} from "./order-payment-failed";
export {
  subject as orderRefundInitiatedSubject,
  html as orderRefundInitiatedHtml,
  text as orderRefundInitiatedText,
} from "./order-refund-initiated";

// Support templates
export {
  subject as supportContactReceivedCustomerSubject,
  html as supportContactReceivedCustomerHtml,
  text as supportContactReceivedCustomerText,
} from "./support-contact-received-customer";
export {
  subject as supportContactNotifyAdminSubject,
  html as supportContactNotifyAdminHtml,
  text as supportContactNotifyAdminText,
} from "./support-contact-notify-admin";

// Types
export * from "./_types";

// Base utilities
export * from "./_base";

