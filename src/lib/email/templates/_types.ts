/**
 * Email template type definitions
 */

export interface Customer {
  firstName?: string;
  lastName?: string;
  email: string;
}

export interface Order {
  id: string;
  createdAt?: string;
  total: number; // in cents
  currency?: "TRY";
  itemsCount: number;
  status?: string;
  shortAddress?: {
    city?: string;
    district?: string;
  };
}

export interface Links {
  accountUrl?: string;
  orderUrl?: string;
  supportUrl?: string;
  verifyEmailUrl?: string;
  resetPasswordUrl?: string;
  trackingUrl?: string;
}

export interface Brand {
  fromNameDefault: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface BaseEmailData {
  customer: Customer;
  brand: Brand;
  links: Links;
}

