/**
 * Browser-facing capability contract. Raw card data is intentionally absent:
 * the eventual bank implementation must use a hosted page, hosted fields or
 * provider tokenization, and all verification remains in Edge Functions.
 */
export interface PublicBankProviderCapabilities {
  configured: boolean;
  hostedPayment: boolean;
  tokenizedPayment: boolean;
  threeDSecure: boolean;
  supportedNetworks: Array<"visa" | "mastercard">;
}

export const pendingBankCapabilities: PublicBankProviderCapabilities = {
  configured: false,
  hostedPayment: false,
  tokenizedPayment: false,
  threeDSecure: false,
  supportedNetworks: [],
};
