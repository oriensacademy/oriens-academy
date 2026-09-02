export type PaymentStatus = "pending" | "requires_action" | "processing" | "paid" | "failed" | "cancelled" | "refunded";
export type PaymentMethod = "card";
export type HistoricalPaymentMethod = PaymentMethod | "bank_transfer";

export interface VerifiedPaymentStatus {
  reference: string;
  packageId: string;
  packageIds?: string[];
  amount: number;
  currency: string;
  status: PaymentStatus;
  statusReason?: string | null;
  paymentMethod: HistoricalPaymentMethod;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}
