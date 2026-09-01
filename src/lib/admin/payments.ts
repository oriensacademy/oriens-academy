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
  refunded_amount: number;
  refund_status: "none" | "partial" | "full";
  last_refunded_at: string | null;
  last_refund_reason: string | null;
  paytr_refund_reference: string | null;
  created_at: string;
  paid_at: string | null;
  metadata?: {
    base_amount?: number;
    discount_amount?: number;
    coupon_code?: string;
    coupon_id?: string;
    locale?: string;
    reminder_count?: number;
    last_reminder_sent_at?: string;
    lesson_count?: number;
    package_name?: string;
  } | null;
}

export interface AdminRefundHistoryRow {
  id: string;
  status: string;
  amount: number;
  lessons: number;
  reason: string;
  provider_reference: string;
  created_at: string;
  finalized_at: string | null;
  admin_actor: string;
  error_code: string | null;
}

export interface AdminRefundContext {
  success: boolean;
  error_code?: string;
  transaction_id: string;
  reference: string;
  account_holder: string | null;
  learner: string | null;
  package_id: string;
  paid_amount: number;
  currency: string;
  refunded_amount: number;
  refundable_amount: number;
  refund_status: "none" | "partial" | "full";
  package_purchase_id: string;
  total_lessons: number;
  completed_lessons: number;
  remaining_lessons: number;
  refunds: AdminRefundHistoryRow[];
}

export interface ListAdminPaymentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  paymentMethod?: string;
  provider?: string;
  packageId?: string;
  period?: "all" | "today" | "last_7_days" | "last_30_days" | "this_month" | "this_year";
  startDate?: string;
  endDate?: string;
}

export interface ListAdminPaymentsResult {
  data: AdminPaymentRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
  error: string | null;
}

export interface AdminFinancialMetrics {
  totalCollected: number;
  paidPackagesCount: number;
  currentMonthCollected: number;
  totalPendingAmount: number;
  pendingCount: number;
  bankTransferPendingAmount: number;
  bankTransferPendingCount: number;
  totalDiscountGiven: number;
  refundedAmount: number;
  refundedCount: number;
  filteredTotalVolume: number;
}

function getDateRangeFilter(period?: string, startDate?: string, endDate?: string): { from?: string; to?: string } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return { from: start };
  }
  if (period === "last_7_days") {
    const d = new Date();
    d.setDate(now.getDate() - 7);
    return { from: d.toISOString() };
  }
  if (period === "last_30_days") {
    const d = new Date();
    d.setDate(now.getDate() - 30);
    return { from: d.toISOString() };
  }
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return { from: start };
  }
  if (period === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1).toISOString();
    return { from: start };
  }
  if (startDate || endDate) {
    return {
      from: startDate ? new Date(startDate).toISOString() : undefined,
      to: endDate ? new Date(endDate).toISOString() : undefined,
    };
  }
  return {};
}

export async function listAdminPaymentsPaginated(
  params: ListAdminPaymentsParams = {}
): Promise<ListAdminPaymentsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(10, Math.min(100, params.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const client = getSupabaseClient();
    let query = client
      .from("payment_transactions")
      .select(
        "id,public_reference,package_id,payer_name,payer_email,payer_phone,amount,currency,payment_method,provider,provider_transaction_id,status,created_at,paid_at,metadata,refunded_amount,refund_status,last_refunded_at,last_refund_reason,paytr_refund_reference",
        { count: "exact" }
      );

    // Apply Search
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      query = query.or(
        `public_reference.ilike.${q},payer_name.ilike.${q},payer_email.ilike.${q},payer_phone.ilike.${q},package_id.ilike.${q},provider.ilike.${q}`
      );
    }

    // Apply Status Filter
    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    // Apply Payment Method Filter
    if (params.paymentMethod && params.paymentMethod !== "all") {
      query = query.eq("payment_method", params.paymentMethod);
    }

    // Apply Provider Filter
    if (params.provider && params.provider !== "all") {
      query = query.eq("provider", params.provider);
    }

    // Apply Package Filter
    if (params.packageId && params.packageId !== "all") {
      query = query.eq("package_id", params.packageId);
    }

    // Apply Date Range
    const { from: dateFrom, to: dateTo } = getDateRangeFilter(
      params.period,
      params.startDate,
      params.endDate
    );
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    // Apply Pagination & Ordering
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[listAdminPaymentsPaginated] Supabase error:", error);
      return {
        data: [],
        totalCount: 0,
        page,
        pageSize,
        pageCount: 0,
        error: error.message,
      };
    }

    const totalCount = count ?? 0;
    const pageCount = Math.ceil(totalCount / pageSize);

    return {
      data: (data ?? []) as AdminPaymentRow[],
      totalCount,
      page,
      pageSize,
      pageCount,
      error: null,
    };
  } catch (err) {
    console.error("[listAdminPaymentsPaginated] Unexpected error:", err);
    return {
      data: [],
      totalCount: 0,
      page,
      pageSize,
      pageCount: 0,
      error: "Ödeme kayıtları yüklenemedi.",
    };
  }
}

export async function getAdminFinancialMetrics(
  params: ListAdminPaymentsParams = {}
): Promise<{ metrics: AdminFinancialMetrics; uniquePackages: string[]; error: string | null }> {
  try {
    const client = getSupabaseClient();
    let query = client
      .from("payment_transactions")
      .select("amount,status,payment_method,created_at,paid_at,metadata,package_id");

    // Apply Search
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      query = query.or(
        `public_reference.ilike.${q},payer_name.ilike.${q},payer_email.ilike.${q},payer_phone.ilike.${q},package_id.ilike.${q},provider.ilike.${q}`
      );
    }

    // Apply Status Filter
    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    // Apply Payment Method Filter
    if (params.paymentMethod && params.paymentMethod !== "all") {
      query = query.eq("payment_method", params.paymentMethod);
    }

    // Apply Package Filter
    if (params.packageId && params.packageId !== "all") {
      query = query.eq("package_id", params.packageId);
    }

    // Apply Date Range
    const { from: dateFrom, to: dateTo } = getDateRangeFilter(
      params.period,
      params.startDate,
      params.endDate
    );
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    const { data, error } = await query.limit(5000);

    if (error) {
      return {
        metrics: {
          totalCollected: 0,
          paidPackagesCount: 0,
          currentMonthCollected: 0,
          totalPendingAmount: 0,
          pendingCount: 0,
          bankTransferPendingAmount: 0,
          bankTransferPendingCount: 0,
          totalDiscountGiven: 0,
          refundedAmount: 0,
          refundedCount: 0,
          filteredTotalVolume: 0,
        },
        uniquePackages: [],
        error: error.message,
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalCollected = 0;
    let paidPackagesCount = 0;
    let currentMonthCollected = 0;
    let totalPendingAmount = 0;
    let pendingCount = 0;
    let bankTransferPendingAmount = 0;
    let bankTransferPendingCount = 0;
    let totalDiscountGiven = 0;
    let refundedAmount = 0;
    let refundedCount = 0;
    let filteredTotalVolume = 0;
    const pkgSet = new Set<string>();

    (data ?? []).forEach((row) => {
      const amount = Number(row.amount) || 0;
      filteredTotalVolume += amount;
      if (row.package_id) pkgSet.add(row.package_id);

      const meta = (row.metadata as Record<string, unknown>) ?? {};
      const discount = Number(meta.discount_amount) || 0;
      totalDiscountGiven += discount;

      const date = new Date(row.paid_at || row.created_at);
      const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;

      if (row.status === "paid") {
        totalCollected += amount;
        paidPackagesCount += 1;
        if (isThisMonth) {
          currentMonthCollected += amount;
        }
      } else if (
        row.status === "pending" ||
        row.status === "requires_action" ||
        row.status === "processing"
      ) {
        totalPendingAmount += amount;
        pendingCount += 1;
        if (row.payment_method === "bank_transfer") {
          bankTransferPendingAmount += amount;
          bankTransferPendingCount += 1;
        }
      } else if (row.status === "refunded") {
        refundedAmount += amount;
        refundedCount += 1;
      }
    });

    return {
      metrics: {
        totalCollected,
        paidPackagesCount,
        currentMonthCollected,
        totalPendingAmount,
        pendingCount,
        bankTransferPendingAmount,
        bankTransferPendingCount,
        totalDiscountGiven,
        refundedAmount,
        refundedCount,
        filteredTotalVolume,
      },
      uniquePackages: Array.from(pkgSet).sort(),
      error: null,
    };
  } catch (err) {
    console.error("[getAdminFinancialMetrics] Error:", err);
    return {
      metrics: {
        totalCollected: 0,
        paidPackagesCount: 0,
        currentMonthCollected: 0,
        totalPendingAmount: 0,
        pendingCount: 0,
        bankTransferPendingAmount: 0,
        bankTransferPendingCount: 0,
        totalDiscountGiven: 0,
        refundedAmount: 0,
        refundedCount: 0,
        filteredTotalVolume: 0,
      },
      uniquePackages: [],
      error: "Mali metrikler hesaplanamadı.",
    };
  }
}

// Backward-compatibility wrapper for any legacy callers
export async function listAdminPayments(): Promise<{ data: AdminPaymentRow[]; error: string | null }> {
  const result = await listAdminPaymentsPaginated({ page: 1, pageSize: 250 });
  return { data: result.data, error: result.error };
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

export async function sendPaymentReminder(paymentId: string) {
  const client = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc("admin_send_payment_reminder", {
    p_payment_id: paymentId,
  });
  if (error) return { success: false, error: error.message };
  const result = data as {
    success?: boolean;
    error_code?: string;
    reminder_count?: number;
    last_reminder_sent_at?: string;
  } | null;
  return {
    success: Boolean(result?.success),
    error: result?.success ? null : result?.error_code || "Hatırlatma gönderilemedi.",
    reminderCount: result?.reminder_count,
    lastReminderSentAt: result?.last_reminder_sent_at,
  };
}

export async function getAdminRefundContext(paymentId: string): Promise<{ data: AdminRefundContext | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc("admin_get_payment_refund_context", { p_transaction_id: paymentId });
  if (error) return { data: null, error: error.message };
  const result = data as unknown as AdminRefundContext;
  return result?.success ? { data: result, error: null } : { data: null, error: result?.error_code || "REFUND_CONTEXT_FAILED" };
}

export async function processPaytrRefund(input: {
  transactionId: string;
  refundAmount: number;
  lessonsToRevoke: number;
  reason: string;
  idempotencyKey: string;
  locale?: "tr" | "en";
}) {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  const { data, error } = await client.functions.invoke("paytr-refund", {
    body: { ...input, locale: input.locale || "tr" },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (error) {
    let code = "REFUND_FAILED";
    let message = "İade işlemi tamamlanamadı.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error_code?: string; message?: string };
        code = body.error_code || code;
        message = body.message || message;
      } catch { /* keep safe fallback */ }
    }
    return { success: false, errorCode: code, error: message };
  }
  return data?.success
    ? { success: true, data: data as Record<string, unknown>, error: null }
    : { success: false, errorCode: data?.error_code || "REFUND_FAILED", error: data?.message || "İade işlemi tamamlanamadı." };
}
