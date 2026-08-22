import type { Locale } from "@/content/dictionaries";

export type PaymentStatus = "pending" | "requires_action" | "processing" | "paid" | "failed" | "cancelled" | "refunded";
export type PaymentMethod = "card" | "bank_transfer";

export interface BankTransferDetails {
  accountHolder: string;
  bankName: string;
  iban: string;
}

export interface CreatePaymentInput {
  packageId: string;
  paymentMethod: PaymentMethod;
  payerName: string;
  payerEmail: string;
  payerPhone?: string;
  locale: Locale;
  termsAccepted: boolean;
  turnstileToken: string;
}

export type CreatePaymentResult =
  | { success: true; reference: string; statusToken: string; status: PaymentStatus; paymentMethod: PaymentMethod; redirectUrl?: string }
  | { success: false; errorCode: string; message: string };

export interface VerifiedPaymentStatus {
  reference: string;
  packageId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}
