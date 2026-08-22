import type { BankPaymentProvider, ProviderCapabilities, ProviderCreateResult, ProviderVerificationResult } from "./types.ts";

export class ProviderConfigurationError extends Error {
  constructor() { super("PENDING_BANK_CREDENTIALS"); }
}

/**
 * Safe default used until official Virtual POS documentation and sandbox
 * credentials are supplied. It never performs a network request and can
 * never report a payment as successful.
 */
class PendingBankProvider implements BankPaymentProvider {
  readonly id = "pending_bank_provider";
  readonly capabilities: ProviderCapabilities = {
    configured: false,
    hostedPayment: false,
    tokenizedPayment: false,
    threeDSecure: false,
    supportedNetworks: [],
  };

  async createPayment(): Promise<ProviderCreateResult> { throw new ProviderConfigurationError(); }
  async verifyPayment(): Promise<ProviderVerificationResult> { throw new ProviderConfigurationError(); }
  async getPaymentStatus(): Promise<ProviderVerificationResult> { throw new ProviderConfigurationError(); }
  async handle3DSecureCallback(): Promise<ProviderVerificationResult> { throw new ProviderConfigurationError(); }
}

export function getBankPaymentProvider(): BankPaymentProvider {
  // Add a documented provider implementation here after the bank contract,
  // official payload/signature specification and sandbox credentials exist.
  return new PendingBankProvider();
}
