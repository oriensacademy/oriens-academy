import { getSupabaseClient } from "@/lib/supabase/client";
import type { VerifiedPaymentStatus } from "./types";
import { LEGAL_VERSIONS } from "@/config/legal";

export interface CreatePaytrTokenInput {
  packageId: string;
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  locale: "tr" | "en";
  termsAccepted?: boolean;
  refundPolicyAccepted?: boolean;
  legalVersions?: {
    salesAgreement?: string;
    preInformation?: string;
    refundPolicy?: string;
  };
}

export interface CreatePaytrTokenResult {
  success: boolean;
  iframe_token?: string;
  merchant_oid?: string;
  reference?: string;
  statusToken?: string;
  final_amount?: number;
  currency?: string;
  errorCode?: string;
  message?: string;
}

export async function createPaytrToken(input: CreatePaytrTokenInput): Promise<CreatePaytrTokenResult> {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const payload = {
      ...input,
      termsAccepted: Boolean(input.termsAccepted),
      refundPolicyAccepted: Boolean(input.refundPolicyAccepted),
      legalVersions: {
        salesAgreement: LEGAL_VERSIONS.salesAgreement,
        preInformation: LEGAL_VERSIONS.preInformation,
        refundPolicy: LEGAL_VERSIONS.refundPolicy,
      },
    };

    const { data, error } = await supabase.functions.invoke("paytr-create-token", {
      body: payload,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (error) {
      let errorCode = "TOKEN_ERROR";
      let message = input.locale === "tr" ? "Ödeme ekranı şu anda hazırlanamadı. Lütfen tekrar deneyin." : "Payment screen could not be prepared. Please try again.";
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const body = (await context.clone().json()) as { error_code?: string; message?: string };
          if (body.error_code) errorCode = body.error_code;
          if (body.message) message = body.message;
        } catch { /* response unavailable */ }
      }
      return { success: false, errorCode, message };
    }

    if (!data?.success || !data?.iframe_token) {
      return {
        success: false,
        errorCode: data?.error_code || "TOKEN_ERROR",
        message: data?.message || (input.locale === "tr" ? "Ödeme ekranı şu anda hazırlanamadı." : "Payment screen could not be prepared."),
      };
    }

    return {
      success: true,
      iframe_token: data.iframe_token,
      merchant_oid: data.merchant_oid,
      reference: data.reference,
      statusToken: data.statusToken,
      final_amount: data.final_amount,
      currency: data.currency,
    };
  } catch {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: input.locale === "tr" ? "Ağ bağlantısı hatası oluştu." : "A network error occurred.",
    };
  }
}

export async function getPaymentStatus(reference: string, statusToken: string): Promise<VerifiedPaymentStatus | null> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke("payment-status", { body: { reference, statusToken } });
    return !error && data?.success ? (data.payment as VerifiedPaymentStatus) : null;
  } catch { return null; }
}
