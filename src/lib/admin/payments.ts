import { getSupabaseClient } from "@/lib/supabase/client";

export interface AdminPaymentRow {
  id: string;
  public_reference: string;
  package_id: string;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone?: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  provider: string;
  provider_transaction_id: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  metadata?: {
    base_amount?: number;
    discount_amount?: number;
    coupon_code?: string;
    coupon_id?: string;
    locale?: string;
  } | null;
}

export async function listAdminPayments(): Promise<{ data: AdminPaymentRow[]; error: string | null }> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("payment_transactions")
      .select("id,public_reference,package_id,payer_name,payer_email,payer_phone,amount,currency,payment_method,provider,provider_transaction_id,status,created_at,paid_at,metadata")
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as AdminPaymentRow[], error: null };
  } catch {
    return { data: [], error: "Ödeme kayıtları yüklenemedi." };
  }
}

export async function reviewManualBankTransfer(paymentId: string, decision: "approved" | "rejected") {
  const { data, error } = await getSupabaseClient().rpc("admin_review_bank_transfer", {
    p_payment_id: paymentId,
    p_decision: decision,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success?: boolean; error_code?: string; already_reviewed?: boolean } | null;
  return {
    success: Boolean(result?.success),
    error: result?.success ? null : result?.error_code || "Ödeme incelemesi tamamlanamadı.",
    alreadyReviewed: Boolean(result?.already_reviewed),
  };
}
