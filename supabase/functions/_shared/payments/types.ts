export type PaymentStatus = "pending" | "requires_action" | "processing" | "paid" | "failed" | "cancelled" | "refunded";
export type PaymentMethod = "card" | "bank_transfer";

export interface ProviderCapabilities {
  configured: boolean;
  hostedPayment: boolean;
  tokenizedPayment: boolean;
  threeDSecure: boolean;
  supportedNetworks: Array<"visa" | "mastercard">;
}

export interface ProviderCreateRequest {
  internalReference: string;
  amount: number;
  currency: string;
  returnUrl: string;
  callbackUrl: string;
}

export interface ProviderCreateResult {
  providerTransactionId: string;
  status: "requires_action" | "processing";
  redirectUrl: string;
}

export interface ProviderVerificationResult {
  verified: boolean;
  internalReference: string;
  providerTransactionId: string;
  status: PaymentStatus;
  safeMetadata?: Record<string, unknown>;
}

export interface BankPaymentProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  createPayment(input: ProviderCreateRequest): Promise<ProviderCreateResult>;
  verifyPayment(providerTransactionId: string): Promise<ProviderVerificationResult>;
  getPaymentStatus(providerTransactionId: string): Promise<ProviderVerificationResult>;
  handle3DSecureCallback(request: Request): Promise<ProviderVerificationResult>;
}
