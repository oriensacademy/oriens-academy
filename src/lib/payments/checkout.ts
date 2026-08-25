import { getSupabaseClient } from "@/lib/supabase/client";

export interface StudentCheckoutInput {
  packageId: string;
  paymentMethod: "bank_transfer" | "card";
  couponCode?: string;
  payerName?: string;
  payerPhone?: string;
  locale: "tr" | "en";
  idempotencyKey?: string;
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
