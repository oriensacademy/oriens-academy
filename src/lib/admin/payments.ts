import { getSupabaseClient } from "@/lib/supabase/client";

// One source of truth for records that represent an actual admin-visible
// payment. Card token preloads/abandoned/expired/failed-before-payment rows
// stay in the database for audit purposes but are not normal payments.
export const ADMIN_PAYMENT_VISIBILITY_FILTER =
  "status.in.(paid,refunded),and(payment_method.eq.bank_transfer,status.in.(pending,requires_action))";

export interface AdminPaymentRow {
  id: string;
  public_reference: string;
  package_id: string;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone?: string | null;
  /** Paketin sahibi öğrenci (veli ödemesinde öğrenci). */
  package_owner_student_id?: string | null;
  student_user_id?: string | null;
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
    failed_reason_code?: string | number | null;
    failed_reason_msg?: string | null;
    paytr_callback?: {
      failed_reason_code?: string | number | null;
      failed_reason_msg?: string | null;
    } | null;
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
        "id,public_reference,package_id,package_owner_student_id,student_user_id,payer_name,payer_email,payer_phone,amount,currency,payment_method,provider,provider_transaction_id,status,created_at,paid_at,metadata,refunded_amount,refund_status,last_refunded_at,last_refund_reason,paytr_refund_reference",
        { count: "exact" }
      )
      .eq("is_archived", false)
      .or(ADMIN_PAYMENT_VISIBILITY_FILTER);

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
      .select("amount,status,payment_method,created_at,paid_at,metadata,package_id,refunded_amount,refund_status")
      .eq("is_archived", false)
      .or(ADMIN_PAYMENT_VISIBILITY_FILTER);

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
      if (row.package_id) pkgSet.add(row.package_id);

      const meta = (row.metadata as Record<string, unknown>) ?? {};
      const discount = Number(meta.discount_amount) || 0;
      totalDiscountGiven += discount;

      const date = new Date(row.paid_at || row.created_at);
      const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;

      if (row.status === "paid") {
        totalCollected += amount;
        filteredTotalVolume += amount;
        paidPackagesCount += 1;
        if (isThisMonth) {
          currentMonthCollected += amount;
        }
        const rowRefunded = Number((row as Record<string, unknown>).refunded_amount) || 0;
        if (rowRefunded > 0) {
          refundedAmount += rowRefunded;
          refundedCount += 1;
        }
      } else if (row.status === "refunded") {
        refundedAmount += amount;
        refundedCount += 1;
      } else if (row.status === "pending" && row.payment_method === "bank_transfer") {
        totalPendingAmount += amount;
        pendingCount += 1;
        bankTransferPendingAmount += amount;
        bankTransferPendingCount += 1;
        filteredTotalVolume += amount;
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
  sendNotification: boolean;
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

// --- Ödemeler sayfası (referans tasarım) ------------------------------------
// Ödemeler listesi istemcide filtrelenir (referans davranışı: anında arama,
// "N / M ödeme gösteriliyor"). Kaynaklar:
//  * payment_transactions: görünür ödemeler + PayTR'den başarısız dönüşü gelmiş
//    kart ödemeleri (yalnız callback kaydı olanlar; terk edilmiş ön yüklemeler hariç).
//  * student_package_purchases: panelden "Yeni Paket Tanımla" ile elle tanımlanan
//    ve ödeme kaydına bağlı olmayan paketler (referans: "Yönetici tarafından eklendi").
// Yalnız okuma; ödeme, defter veya ders hakkı mantığına dokunmaz.

export const ADMIN_PAYMENT_LIST_FILTER =
  `${ADMIN_PAYMENT_VISIBILITY_FILTER},and(status.eq.failed,metadata->paytr_callback.not.is.null)`;

export type AdminLedgerStatus = "odendi" | "iade" | "bekliyor" | "basarisiz";
export type AdminLedgerSource = "paytr" | "banka" | "ucretsiz";

export interface AdminPaymentLedgerRow {
  key: string;
  transaction: AdminPaymentRow | null;
  payerName: string;
  studentId: string | null;
  studentName: string | null;
  email: string | null;
  phone: string | null;
  packageId: string;
  packageLabel: string;
  baseAmount: number;
  netAmount: number;
  refundedAmount: number;
  couponCode: string | null;
  currency: string;
  status: AdminLedgerStatus;
  source: AdminLedgerSource;
  reference: string | null;
  adminNote: string | null;
  at: string;
}

export function adminLedgerStatus(row: Pick<AdminPaymentRow, "status" | "refund_status">): AdminLedgerStatus {
  if (row.status === "refunded" || row.refund_status === "full") return "iade";
  if (row.status === "paid") return "odendi";
  if (row.status === "failed") return "basarisiz";
  return "bekliyor";
}

/** Referans: iade yalnız kredi kartı + ödendi + iade edilebilir tutar > 0 iken. */
export function canRefundLedgerRow(row: AdminPaymentLedgerRow): boolean {
  const tx = row.transaction;
  if (!tx || row.source !== "paytr" || row.status !== "odendi") return false;
  if (tx.provider !== "paytr" || tx.payment_method !== "card" || tx.refund_status === "full") return false;
  return row.netAmount - row.refundedAmount > 0;
}

export type LedgerPackageLabel = (source: { package_id: string; custom_package_name?: string | null; metadata?: unknown }) => string;

export function toLedgerRowFromTransaction(row: AdminPaymentRow, names: Map<string, string>, label: LedgerPackageLabel): AdminPaymentLedgerRow {
  const meta = row.metadata ?? {};
  const amount = Number(row.amount) || 0;
  const base = Number(meta.base_amount) || 0;
  const studentId = row.package_owner_student_id || row.student_user_id || null;
  return {
    key: `tx:${row.id}`,
    transaction: row,
    payerName: row.payer_name?.trim() || "—",
    studentId,
    studentName: studentId ? names.get(studentId) || null : null,
    email: row.payer_email,
    phone: row.payer_phone ?? null,
    packageId: row.package_id,
    packageLabel: label({ package_id: row.package_id, metadata: row.metadata }),
    baseAmount: base > amount ? base : amount,
    netAmount: amount,
    refundedAmount: Number(row.refunded_amount) || 0,
    couponCode: meta.coupon_code?.trim() || null,
    currency: row.currency || "TRY",
    status: adminLedgerStatus(row),
    source: row.payment_method === "bank_transfer" ? "banka" : "paytr",
    reference: row.public_reference || null,
    adminNote: null,
    at: row.created_at,
  };
}

export interface ManualPurchaseLedgerSource {
  id: string;
  student_user_id: string | null;
  package_id: string;
  custom_package_name: string | null;
  lesson_count: number;
  price_amount: number | null;
  currency: string;
  payment_status: string;
  admin_notes: string | null;
  created_at: string;
}

export function toLedgerRowFromManualPurchase(
  row: ManualPurchaseLedgerSource,
  names: Map<string, string>,
  guardians: Map<string, { name: string; email: string | null; phone: string | null }>,
  label: LedgerPackageLabel,
): AdminPaymentLedgerRow {
  const free = row.payment_status === "waived";
  const amount = free ? 0 : Number(row.price_amount) || 0;
  const studentName = row.student_user_id ? names.get(row.student_user_id) || null : null;
  const guardian = row.student_user_id ? guardians.get(row.student_user_id) : undefined;
  return {
    key: `pk:${row.id}`,
    transaction: null,
    payerName: guardian?.name || studentName || "—",
    studentId: row.student_user_id,
    studentName: guardian ? studentName : null,
    email: guardian?.email ?? null,
    phone: guardian?.phone ?? null,
    packageId: row.package_id,
    packageLabel: label({ package_id: row.package_id, custom_package_name: row.custom_package_name, metadata: { lesson_count: row.lesson_count } }),
    baseAmount: amount,
    netAmount: amount,
    refundedAmount: 0,
    couponCode: null,
    currency: row.currency || "TRY",
    status: row.payment_status === "pending" ? "bekliyor" : row.payment_status === "refunded" ? "iade" : "odendi",
    source: free ? "ucretsiz" : "banka",
    reference: null,
    adminNote: row.admin_notes?.trim() || null,
    at: row.created_at,
  };
}

export async function listAdminPaymentLedger(label: LedgerPackageLabel): Promise<{ data: AdminPaymentLedgerRow[]; error: string | null }> {
  const supabase = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untyped = supabase as any;
  const [tx, manual] = await Promise.all([
    supabase
      .from("payment_transactions")
      .select("id,public_reference,package_id,package_owner_student_id,student_user_id,payer_name,payer_email,payer_phone,amount,currency,payment_method,provider,provider_transaction_id,status,created_at,paid_at,metadata,refunded_amount,refund_status,last_refunded_at,last_refund_reason,paytr_refund_reference")
      .eq("is_archived", false)
      .or(ADMIN_PAYMENT_LIST_FILTER)
      .order("created_at", { ascending: false })
      .limit(2000),
    untyped
      .from("student_package_purchases")
      .select("id,student_user_id,package_id,custom_package_name,lesson_count,price_amount,currency,payment_status,admin_notes,created_at")
      .eq("assignment_source", "admin_manual")
      .is("payment_transaction_id", null)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(2000) as Promise<{ data: ManualPurchaseLedgerSource[] | null; error: unknown }>,
  ]);
  if (tx.error) return { data: [], error: "Ödeme kayıtları yüklenemedi." };
  const transactions = (tx.data ?? []) as unknown as AdminPaymentRow[];
  const purchases = manual.error ? [] : manual.data ?? [];

  const studentIds = Array.from(new Set([
    ...transactions.map((row) => row.package_owner_student_id || row.student_user_id),
    ...purchases.map((row) => row.student_user_id),
  ].filter((id): id is string => Boolean(id))));
  const manualStudentIds = Array.from(new Set(purchases.map((row) => row.student_user_id).filter((id): id is string => Boolean(id))));

  const names = new Map<string, string>();
  const guardians = new Map<string, { name: string; email: string | null; phone: string | null }>();
  if (studentIds.length) {
    const [profiles, links] = await Promise.all([
      supabase.from("student_profiles").select("id,full_name").in("id", studentIds),
      manualStudentIds.length
        ? (untyped
            .from("guardian_students")
            .select("student_id,is_primary,guardian_accounts(full_name,email,phone)")
            .in("student_id", manualStudentIds)
            .eq("active", true) as Promise<{ data: unknown[] | null }>)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);
    for (const p of (profiles.data ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name?.trim()) names.set(p.id, p.full_name.trim());
    }
    const linkRows = ((links.data ?? []) as { student_id: string; is_primary: boolean; guardian_accounts: { full_name: string; email: string; phone: string | null } | null }[])
      .slice()
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    for (const link of linkRows) {
      if (!link.guardian_accounts || guardians.has(link.student_id)) continue;
      guardians.set(link.student_id, { name: link.guardian_accounts.full_name, email: link.guardian_accounts.email, phone: link.guardian_accounts.phone });
    }
  }

  const rows = [
    ...transactions.map((row) => toLedgerRowFromTransaction(row, names, label)),
    ...purchases.map((row) => toLedgerRowFromManualPurchase(row, names, guardians, label)),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { data: rows, error: null };
}
