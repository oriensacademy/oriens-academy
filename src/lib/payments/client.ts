import { getSupabaseClient } from "@/lib/supabase/client";
import type { VerifiedPaymentStatus } from "./types";
import { LEGAL_VERSIONS } from "@/config/legal";
import { paymentErrorMessage } from "./public-errors";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

const SESSION_EXPIRY_BUFFER_SECONDS = 60;
const MOCK_PAYMENT_TOKEN = "mock-dev-access-token";

export interface CreatePaytrTokenInput {
  packageIds: string[];
  couponCode?: string;
  learnerId: string;
  guardianUserId?: string;
  paymentPhone: string;
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
  zero_payment?: boolean;
  merchant_oid?: string;
  reference?: string;
  statusToken?: string;
  final_amount?: number;
  currency?: string;
  errorCode?: string;
  message?: string;
  legal_accepted?: boolean;
}

type PaymentAuthClient = Pick<SupabaseClient, "auth">;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = globalThis.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isUsablePaymentSession(
  session: Session | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): session is Session {
  if (!session?.access_token || !session.user?.id || session.access_token === MOCK_PAYMENT_TOKEN) return false;
  const payload = decodeJwtPayload(session.access_token);
  if (!payload) return false;
  const expiresAt = Number(payload.exp ?? session.expires_at ?? 0);
  return (
    payload.role === "authenticated" &&
    payload.sub === session.user.id &&
    Number.isFinite(expiresAt) &&
    expiresAt > nowSeconds + SESSION_EXPIRY_BUFFER_SECONDS
  );
}

export async function resolvePaymentSession(
  client: PaymentAuthClient,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<Session | null> {
  const current = await client.auth.getSession();
  if (!current.error && isUsablePaymentSession(current.data.session, nowSeconds)) {
    return current.data.session;
  }

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !isUsablePaymentSession(refreshed.data.session, nowSeconds)) return null;
  return refreshed.data.session;
}

export async function createPaytrToken(input: CreatePaytrTokenInput): Promise<CreatePaytrTokenResult> {
  try {
    const supabase = getSupabaseClient();
    const session = await resolvePaymentSession(supabase);
    if (!session) {
      return {
        success: false,
        errorCode: "SESSION_EXPIRED",
        message: paymentErrorMessage("SESSION_EXPIRED", input.locale),
      };
    }

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
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      let errorCode = "TOKEN_ERROR";
      let serverMessage: string | undefined;
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const body = (await context.clone().json()) as { error_code?: string; message?: string };
          if (body.error_code) errorCode = body.error_code;
          if (body.message) serverMessage = body.message;
        } catch { /* response unavailable */ }
      }
      return { success: false, errorCode, message: paymentErrorMessage(errorCode, input.locale, serverMessage) };
    }

    if (!data?.success || (!data?.iframe_token && !data?.zero_payment)) {
      return {
        success: false,
        errorCode: data?.error_code || "TOKEN_ERROR",
        message: paymentErrorMessage(data?.error_code, input.locale, data?.message),
      };
    }

    return {
      success: true,
      iframe_token: data.iframe_token,
      zero_payment: Boolean(data.zero_payment),
      merchant_oid: data.merchant_oid,
      reference: data.reference,
      statusToken: data.statusToken,
      final_amount: data.final_amount,
      currency: data.currency,
      legal_accepted: Boolean(data.legal_accepted),
    };
  } catch {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: input.locale === "tr" ? "Ağ bağlantısı hatası oluştu." : "A network error occurred.",
    };
  }
}

export async function confirmPaymentAgreements(
  reference: string,
  legalVersions?: { salesAgreement?: string; preInformation?: string; refundPolicy?: string }
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("confirm_payment_agreements", {
      p_merchant_oid: reference,
      p_legal_versions: legalVersions || {
        salesAgreement: LEGAL_VERSIONS.salesAgreement,
        preInformation: LEGAL_VERSIONS.preInformation,
        refundPolicy: LEGAL_VERSIONS.refundPolicy,
      },
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function getPaymentStatus(reference: string, statusToken: string): Promise<VerifiedPaymentStatus | null> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke("payment-status", { body: { reference, statusToken } });
    return !error && data?.success ? (data.payment as VerifiedPaymentStatus) : null;
  } catch { return null; }
}
