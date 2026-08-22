import { getSupabaseClient } from "@/lib/supabase/client";

export interface StudentCheckoutInput {
  packageId: string;
  paymentMethod: "bank_transfer" | "card";
  couponCode?: string;
  payerName?: string;
  payerPhone?: string;
  locale: "tr" | "en";
  idempotencyKey?: string;
  mockCardAction?: "success" | "failure" | "cancel"; // Only in development
}

export interface StudentCheckoutResult {
  success: boolean;
  transactionId?: string;
  publicReference?: string;
  baseAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  currency?: string;
  status?: string;
  paymentMethod?: string;
  packageName?: string;
  lessonCount?: number;
  redirectUrl?: string;
  errorCode?: string;
  message?: string;
}

export async function processStudentCheckout(
  input: StudentCheckoutInput
): Promise<StudentCheckoutResult> {
  const supabase = getSupabaseClient();
  const idempotencyKey =
    input.idempotencyKey || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const { data, error } = await supabase.rpc("create_student_checkout", {
      p_package_id: input.packageId,
      p_payment_method: input.paymentMethod,
      p_coupon_code: input.couponCode?.trim() || null,
      p_payer_name: input.payerName?.trim() || null,
      p_payer_phone: input.payerPhone?.trim() || null,
      p_idempotency_key: idempotencyKey,
      p_locale: input.locale,
    });

    if (error) {
      return {
        success: false,
        errorCode: "RPC_ERROR",
        message: error.message || (input.locale === "tr" ? "Sipariş oluşturulamadı." : "Order could not be created."),
      };
    }

    const res = data as Record<string, unknown>;
    if (!res || res.success !== true) {
      return {
        success: false,
        errorCode: String(res?.error_code || "CHECKOUT_FAILED"),
        message: String(
          res?.message ||
            (input.locale === "tr" ? "Sipariş oluşturulamadı." : "Order could not be created.")
        ),
      };
    }

    const transactionId = String(res.transaction_id);
    const publicReference = String(res.public_reference);
    const finalAmount = Number(res.final_amount);
    const baseAmount = Number(res.base_amount);
    const discountAmount = Number(res.discount_amount);
    const currency = String(res.currency || "TRY");
    const status = String(res.status || "pending");
    const packageName = input.locale === "tr" ? String(res.package_name_tr || "") : String(res.package_name_en || "");
    const lessonCount = Number(res.lesson_count || 0);

    // Development-only Local Card Mock Handling
    if (
      process.env.NODE_ENV === "development" &&
      input.paymentMethod === "card" &&
      input.mockCardAction
    ) {
      if (input.mockCardAction === "success") {
        // Activate package locally in development mock
        await supabase
          .from("payment_transactions")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            provider: "local_mock",
            provider_transaction_id: `mock_${Date.now()}`,
          })
          .eq("id", transactionId);

        return {
          success: true,
          transactionId,
          publicReference,
          baseAmount,
          discountAmount,
          finalAmount,
          currency,
          status: "paid",
          paymentMethod: "card",
          packageName,
          lessonCount,
        };
      } else if (input.mockCardAction === "failure") {
        await supabase
          .from("payment_transactions")
          .update({
            status: "failed",
            provider: "local_mock",
          })
          .eq("id", transactionId);

        return {
          success: false,
          errorCode: "MOCK_CARD_FAILED",
          message: input.locale === "tr" ? "Kart ödemesi banka tarafından reddedildi (Simülasyon)." : "Card payment was declined by the bank (Simulation).",
        };
      } else if (input.mockCardAction === "cancel") {
        await supabase
          .from("payment_transactions")
          .update({
            status: "cancelled",
            provider: "local_mock",
          })
          .eq("id", transactionId);

        return {
          success: false,
          errorCode: "MOCK_CARD_CANCELLED",
          message: input.locale === "tr" ? "Ödeme işlemi iptal edildi (Simülasyon)." : "Payment was cancelled (Simulation).",
        };
      }
    }

    return {
      success: true,
      transactionId,
      publicReference,
      baseAmount,
      discountAmount,
      finalAmount,
      currency,
      status,
      paymentMethod: input.paymentMethod,
      packageName,
      lessonCount,
    };
  } catch {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      message: input.locale === "tr" ? "Ağ bağlantısı hatası oluştu." : "A network error occurred.",
    };
  }
}
