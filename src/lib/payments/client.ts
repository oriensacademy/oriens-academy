import { getSupabaseClient } from "@/lib/supabase/client";
import type { BankTransferDetails, CreatePaymentInput, CreatePaymentResult, VerifiedPaymentStatus } from "./types";

const bankSettingKeys = ["payment.bank_account_holder", "payment.bank_name", "payment.iban"] as const;

export async function getPublicBankTransferDetails(): Promise<BankTransferDetails | null> {
  try {
    const { data, error } = await getSupabaseClient().from("site_settings").select("key,value").in("key", [...bankSettingKeys]).eq("is_public", true);
    if (error || !data) return null;
    const values = new Map(data.map((row) => [row.key, typeof row.value === "object" && row.value !== null && "value" in row.value ? String((row.value as { value: unknown }).value).trim() : ""]));
    const details = { accountHolder: values.get(bankSettingKeys[0]) ?? "", bankName: values.get(bankSettingKeys[1]) ?? "", iban: values.get(bankSettingKeys[2]) ?? "" };
    return details.accountHolder && details.bankName && details.iban ? details : null;
  } catch { return null; }
}

function localizedError(code: string, locale: "tr" | "en") {
  const tr = locale === "tr";
  if (code === "PENDING_BANK_CREDENTIALS" || code === "PAYTR_NOT_CONFIGURED") return tr ? "Kartlı ödeme altyapısı şu anda kullanılamıyor." : "Card payments are currently unavailable.";
  if (code === "PACKAGE_NOT_PURCHASABLE") return tr ? "Bu paket çevrim içi satın almaya açık değil." : "This package is not enabled for online purchase.";
  if (code.includes("TURNSTILE") || code.includes("BOT_")) return tr ? "Güvenlik doğrulaması tamamlanamadı." : "Security verification could not be completed.";
  return tr ? "Ödeme talebi oluşturulamadı. Lütfen yeniden deneyin." : "The payment request could not be created. Please try again.";
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke("create-payment", { body: input });
    if (error) {
      let errorCode = "NETWORK_ERROR";
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try { errorCode = String((await context.clone().json() as { error_code?: string }).error_code ?? errorCode); } catch { /* response unavailable */ }
      }
      return { success: false, errorCode, message: localizedError(errorCode, input.locale) };
    }
    if (!data?.success) {
      const errorCode = String(data?.error_code ?? "PAYMENT_CREATE_FAILED");
      return { success: false, errorCode, message: localizedError(errorCode, input.locale) };
    }
    return data as CreatePaymentResult;
  } catch { return { success: false, errorCode: "NETWORK_ERROR", message: localizedError("NETWORK_ERROR", input.locale) }; }
}

export interface CreatePaytrTokenInput {
  packageId: string;
  couponCode?: string;
  payerName?: string;
  payerPhone?: string;
  locale: "tr" | "en";
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

    const { data, error } = await supabase.functions.invoke("paytr-create-token", {
      body: input,
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
