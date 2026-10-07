export type PaymentStatus = "pending" | "requires_action" | "processing" | "paid" | "failed" | "cancelled" | "refunded";
export type PaymentMethod = "card";
export type HistoricalPaymentMethod = PaymentMethod | "bank_transfer";

export interface VerifiedPaymentStatus {
  reference: string;
  packageId: string;
  packageIds?: string[];
  packageName?: string;
  packageNames?: string[];
  lessonCount?: number;
  amount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  currency: string;
  status: PaymentStatus;
  statusReason?: string | null;
  failureCode?: string | null;
  paymentMethod: HistoricalPaymentMethod;
  provider: string;
  createdAt: string;
  updatedAt?: string;
  paidAt: string | null;
}
