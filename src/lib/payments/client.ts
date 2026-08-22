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
  if (code === "PENDING_BANK_CREDENTIALS") return tr ? "Kartlı ödeme altyapısı banka bilgileri beklenirken kullanılamıyor." : "Card payments are unavailable while bank credentials are pending.";
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

export async function getPaymentStatus(reference: string, statusToken: string): Promise<VerifiedPaymentStatus | null> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke("payment-status", { body: { reference, statusToken } });
    return !error && data?.success ? data.payment as VerifiedPaymentStatus : null;
  } catch { return null; }
}
