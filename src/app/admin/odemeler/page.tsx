"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilterX,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  WalletCards,
} from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import {
  listAdminPaymentsPaginated,
  processPaytrRefund,
  reviewManualBankTransfer,
  sendPaymentReminder,
  type AdminPaymentRow,
} from "@/lib/admin/payments";
import { PaymentRefundDialog, type RefundReviewRequest } from "@/components/admin/PaymentRefundDialog";
import { getPaymentRefundCopy } from "@/content/payment-refund";
import { formatCurrency } from "@/lib/format/currency";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";
import { getAdminPaymentStatus } from "@/lib/admin/payment-status";

export default function AdminPaymentsPage() {
  const refundCopy = getPaymentRefundCopy("tr");
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Read state from URL
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.max(10, Math.min(100, Number(searchParams.get("pageSize") || "25")));
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const paymentMethod = searchParams.get("paymentMethod") || "all";
  const provider = searchParams.get("provider") || "all";
  const packageId = searchParams.get("packageId") || "all";
  const period = (searchParams.get("period") as "all" | "today" | "last_7_days" | "last_30_days" | "this_month" | "this_year") || "all";

  const [searchInput, setSearchInput] = useState(search);
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [reviewing, setReviewing] = useState("");
  const [reminding, setReminding] = useState("");
  const [refundRow, setRefundRow] = useState<AdminPaymentRow | null>(null);
  const [refunding, setRefunding] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateUrl = useCallback(
    (updates: Record<string, string | number | null>) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === "" || v === "all" || (k === "page" && v === 1) || (k === "pageSize" && v === 25)) {
          current.delete(k);
        } else {
          current.set(k, String(v));
        }
      });
      startTransition(() => {
        router.replace(`${pathname}?${current.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    let active = true;
    listAdminPaymentsPaginated({
      page,
      pageSize,
      search,
      status,
      paymentMethod,
      provider,
      packageId,
      period,
    }).then((res) => {
      if (!active) return;
      setRows(res.data);
      setTotalCount(res.totalCount);
      setPageCount(res.pageCount || 1);
      setError(res.error || "");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [page, pageSize, search, status, paymentMethod, provider, packageId, period, refreshTrigger]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl({ search: searchInput.trim(), page: 1 });
  }

  function clearFilters() {
    setSearchInput("");
    router.replace(pathname);
  }

  function refresh() {
    setLoading(true);
    setRefreshTrigger((c) => c + 1);
  }

  const hasActiveFilters = Boolean(
    search || status !== "all" || paymentMethod !== "all" || provider !== "all" || packageId !== "all" || period !== "all"
  );

  function review(row: AdminPaymentRow, decision: "approved" | "rejected") {
    const description =
      decision === "approved"
        ? `"${row.payer_name || row.payer_email}" adlı öğrencinin "${row.public_reference}" numaralı havale tahsilatını onaylıyor musunuz? Bu işlem paketi otomatik olarak etkinleştirecektir.`
        : `"${row.public_reference}" numaralı havale talebini reddetmek istediğinize emin misiniz?`;
    requestConfirmation({
      title: decision === "approved" ? "Havale ödemesini onayla" : "Havale talebini reddet",
      description,
      confirmLabel: decision === "approved" ? "Onayla" : "Reddet",
      destructive: decision === "rejected",
      action: async () => {
        setReviewing(row.id);
        setMessage("");
        const r = await reviewManualBankTransfer(row.id, decision);
        setReviewing("");
        if (r.error) setError(r.error);
        else {
          setMessage(`"${row.public_reference}" işlemi başarıyla ${decision === "approved" ? "onaylandı ve paket aktif edildi" : "reddedildi"}.`);
          refresh();
        }
      },
    });
  }

  function handleSendReminder(row: AdminPaymentRow) {
    requestConfirmation({
      title: "Ödeme hatırlatması gönder",
      description: `"${row.payer_email || row.payer_name}" adresine "${row.public_reference}" numaralı işlem için banka havalesi hatırlatması gönderilecek.`,
      confirmLabel: "Gönder",
      destructive: false,
      action: async () => {
        setReminding(row.id);
        setMessage("");
        setError("");
        const r = await sendPaymentReminder(row.id);
        setReminding("");
        if (r.error) setError(r.error);
        else {
          setMessage(`"${row.public_reference}" işlemi için ödeme hatırlatma e-postası başarıyla gönderildi (Toplam ${r.reminderCount}. hatırlatma).`);
          refresh();
        }
      },
    });
  }

  function reviewRefund(request: RefundReviewRequest) {
    const { context, refundAmount, lessonsToRevoke, reason, idempotencyKey } = request;
    requestConfirmation({
      title: "İade işlemini onayla",
      description: `${context.account_holder || "Hesap sahibi"}${context.learner ? ` / ${context.learner}` : ""} · ${context.reference} · ${money(refundAmount, context.currency)} iade · ${lessonsToRevoke} ders hakkı iptali · işlem sonrası ${context.remaining_lessons - lessonsToRevoke} kalan hak · Neden: ${reason}`,
      confirmLabel: "İadeyi Onayla",
      destructive: true,
      action: async () => {
        setRefunding(context.transaction_id);
        setError("");
        setMessage("");
        const result = await processPaytrRefund({ transactionId: context.transaction_id, refundAmount, lessonsToRevoke, reason, idempotencyKey, locale: "tr" });
        setRefunding("");
        if (!result.success) {
          setError(result.error || refundCopy.failed);
          return;
        }
        setRefundRow(null);
        setMessage(refundCopy.success);
        refresh();
      },
    });
  }

  function money(amount: number, currency = "TRY") {
    return formatCurrency(amount, { currency, locale: "tr" });
  }

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(totalCount, page * pageSize);

  return (
    <div className="space-y-6">
      {confirmationDialog}
      {refundRow ? <PaymentRefundDialog row={refundRow} onClose={() => { if (!refunding) setRefundRow(null); }} onReview={reviewRefund} /> : null}
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-[#DDE4DC] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold text-[#10271B]">Ödemeler</h1>
          </div>
          <p className="mt-1 text-xs text-[#68756C]">
            Öğrenci paket satın alma ve ödeme işlemlerini sunucu taraflı filtreleyin; havaleleri doğrulayın veya hatırlatma gönderin.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#DDE4DC] bg-white px-3 text-xs font-semibold text-[#10271B] hover:bg-[#F2F5EF] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </header>

      {message && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          {message}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="size-4 shrink-0 text-red-600" />
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-white p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-[#819586]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Öğrenci adı, e-posta, telefon, referans numarası ara…"
              className="min-h-9 w-full rounded-lg border border-[#DDE4DC] pl-9 pr-3 text-xs text-[#10271B] focus:border-[#819586] focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#10271B] px-4 text-xs font-semibold text-white hover:bg-[#203D2D] cursor-pointer transition-colors"
          >
            Ara
          </button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 pt-1 border-t border-[#F2F5EF]">
          {/* Status */}
          <select
            value={status}
            onChange={(e) => updateUrl({ status: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-[#DDE4DC] bg-white px-2.5 text-xs text-[#10271B] focus:border-[#819586] focus:outline-hidden"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="paid">Ödendi (Paid)</option>
            <option value="pending">Bekliyor</option>
            <option value="requires_action">Doğrulama Gerekli</option>
            <option value="processing">İşleniyor</option>
            <option value="refunded">İade (Refunded)</option>
            <option value="failed">Başarısız</option>
            <option value="cancelled">İptal</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethod}
            onChange={(e) => updateUrl({ paymentMethod: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-[#DDE4DC] bg-white px-2.5 text-xs text-[#10271B] focus:border-[#819586] focus:outline-hidden"
          >
            <option value="all">Tüm Ödeme Yöntemleri</option>
            <option value="card">Kredi / Banka Kartı</option>
            <option value="bank_transfer">Banka Havalesi / EFT</option>
          </select>

          {/* Provider */}
          <select
            value={provider}
            onChange={(e) => updateUrl({ provider: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-[#DDE4DC] bg-white px-2.5 text-xs text-[#10271B] focus:border-[#819586] focus:outline-hidden"
          >
            <option value="all">Tüm Sağlayıcılar</option>
            <option value="paytr">PayTR</option>
            <option value="manual_bank_transfer">Manuel Havale</option>
            <option value="local_mock">Local Mock Simulator</option>
          </select>

          {/* Date Range */}
          <select
            value={period}
            onChange={(e) => updateUrl({ period: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-[#DDE4DC] bg-white px-2.5 text-xs text-[#10271B] focus:border-[#819586] focus:outline-hidden"
          >
            <option value="all">Tüm Zamanlar</option>
            <option value="today">Bugün</option>
            <option value="last_7_days">Son 7 Gün</option>
            <option value="last_30_days">Son 30 Gün</option>
            <option value="this_month">Bu Ay</option>
            <option value="this_year">Bu Yıl</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
            >
              <FilterX className="size-3.5" />
              Filtreleri Temizle
            </button>
          ) : (
            <div className="hidden lg:block text-right self-center text-[11px] text-[#68756C]">
              Toplam <strong>{totalCount}</strong> kayıt
            </div>
          )}
        </div>
      </div>

      {/* Results Header & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#68756C] px-1">
        <div>
          Kayıtlar: <strong className="text-[#10271B]">{startRecord}–{endRecord}</strong> / {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[#68756C]">Sayfa Başına:</label>
          <select
            value={pageSize}
            onChange={(e) => updateUrl({ pageSize: Number(e.target.value), page: 1 })}
            className="rounded-lg border border-[#DDE4DC] bg-white px-2 py-1 text-xs text-[#10271B]"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Table & Empty / Loading States */}
      {loading ? (
        <div className="rounded-2xl border border-[#DDE4DC] bg-white p-12">
          <AdminWaveStatus label="Ödemeler yükleniyor…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDE4DC] bg-white p-12 text-center text-xs text-[#68756C]">
          {hasActiveFilters
            ? "Filtre kriterlerine uygun ödeme kaydı bulunamadı. Lütfen filtrelerinizi kontrol edin."
            : "Henüz ödeme kaydı bulunmuyor."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#DDE4DC] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="border-b border-[#DDE4DC] bg-[#F9FAF8] text-[10px] uppercase tracking-wider text-[#68756C]">
                <tr>
                  <th className="px-4 py-3.5">Öğrenci</th>
                  <th className="px-4 py-3.5">Paket</th>
                  <th className="px-4 py-3.5">Tutar & İndirim</th>
                  <th className="px-4 py-3.5">Ödeme Yöntemi</th>
                  <th className="px-4 py-3.5">Sağlayıcı</th>
                  <th className="px-4 py-3.5">Durum</th>
                  <th className="px-4 py-3.5">Tarih / Hatırlatma</th>
                  <th className="px-4 py-3.5">Referans / İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE4DC]">
                {rows.map((row) => {
                  const meta = row.metadata ?? {};
                  const couponCode = meta.coupon_code;
                  const discountAmount = meta.discount_amount ? Number(meta.discount_amount) : 0;
                  const baseAmount = meta.base_amount ? Number(meta.base_amount) : row.amount;
                  const reminderCount = meta.reminder_count ? Number(meta.reminder_count) : 0;
                  const lastReminder = meta.last_reminder_sent_at
                    ? new Date(meta.last_reminder_sent_at).toLocaleString("tr-TR")
                    : null;
                  const st = getAdminPaymentStatus(row.status, row.metadata);
                  const displayedStatus = row.refund_status === "partial"
                    ? { label: refundCopy.partiallyRefunded, bg: "bg-purple-50 border-purple-200", text: "text-purple-800" }
                    : row.refund_status === "full"
                      ? { label: refundCopy.refunded, bg: "bg-purple-50 border-purple-200", text: "text-purple-800" }
                      : st;
                  const reviewable =
                    row.payment_method === "bank_transfer" &&
                    row.provider === "manual_bank_transfer" &&
                    ["pending", "processing", "requires_action"].includes(row.status);

                  return (
                    <tr key={row.id} className="hover:bg-[#F7F9F6] transition-colors">
                      <td className="px-4 py-3.5">
                        <strong className="block text-[#10271B]">{row.payer_name || "—"}</strong>
                        <span className="text-[10px] text-[#68756C]">{row.payer_email || "—"}</span>
                        {row.payer_phone && <span className="block text-[10px] text-[#68756C]">{row.payer_phone}</span>}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-medium text-[#10271B]">{row.package_id}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-sm text-[#10271B]">{money(row.amount, row.currency)}</div>
                        {Number(row.refunded_amount || 0) > 0 ? <div className="mt-1 text-[10px] font-semibold text-purple-800">{refundCopy.refundedAmount}: {money(Number(row.refunded_amount), row.currency)} · {refundCopy.refundableAmount}: {money(Math.max(0, row.amount - Number(row.refunded_amount)), row.currency)}</div> : null}
                        {couponCode && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-800">
                            <Tag className="size-3" />
                            <span className="font-mono font-semibold">{couponCode}</span>
                            <span>(-{money(discountAmount, row.currency)})</span>
                          </div>
                        )}
                        {baseAmount > row.amount && (
                          <div className="text-[10px] text-[#68756C] line-through">
                            Baz: {money(baseAmount, row.currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.payment_method === "bank_transfer" ? "Banka Havalesi / EFT" : "Kredi / Banka Kartı"}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-[#68756C]">
                        {row.provider === "manual_bank_transfer"
                          ? "Manuel Havale"
                          : row.provider === "local_mock"
                            ? "Local Mock Simulator"
                            : row.provider}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${displayedStatus.bg} ${displayedStatus.text}`}>
                          {displayedStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-[#68756C]">
                        <div>{new Date(row.created_at).toLocaleString("tr-TR")}</div>
                        {reminderCount > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-800 font-medium">
                            <BellRing className="size-3" />
                            <span>{reminderCount}x Hatırlatma</span>
                            {lastReminder && <span className="text-[#819586]">({lastReminder})</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-[11px] text-[#10271B]">{row.public_reference}</span>
                        {reviewable && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={reviewing === row.id || reminding === row.id}
                              onClick={() => void review(row, "approved")}
                              className="rounded-lg bg-[#10271B] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-[#203D2D] disabled:opacity-50 cursor-pointer"
                            >
                              {reviewing === row.id ? "İşleniyor…" : "Tahsilatı Onayla"}
                            </button>
                            <button
                              type="button"
                              disabled={reviewing === row.id || reminding === row.id}
                              onClick={() => void handleSendReminder(row)}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                            >
                              {reminding === row.id ? "Gönderiliyor…" : "Hatırlatma Gönder"}
                            </button>
                            <button
                              type="button"
                              disabled={reviewing === row.id || reminding === row.id}
                              onClick={() => void review(row, "rejected")}
                              className="rounded-lg border border-[#DDE4DC] px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                            >
                              Reddet
                            </button>
                          </div>
                        )}
                        {row.status === "paid" && row.payment_method === "card" && row.provider === "paytr" && row.refund_status !== "full" ? <div className="mt-2"><button type="button" disabled={refunding === row.id} onClick={() => setRefundRow(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-900 hover:bg-purple-100 disabled:opacity-50"><RotateCcw className="size-3" />{refunding === row.id ? "İşleniyor…" : refundCopy.action}</button>{row.paytr_refund_reference ? <span className="mt-1 block font-mono text-[9px] text-purple-700">{row.paytr_refund_reference}</span> : null}{row.last_refund_reason ? <span className="mt-1 block text-[9px] text-muted-foreground">{row.last_refund_reason}</span> : null}</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          {pageCount > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#DDE4DC] px-4 py-3 bg-[#F9FAF8] text-xs">
              <div className="text-[#68756C]">
                Sayfa <strong>{page}</strong> / {pageCount} (Toplam {totalCount} ödeme)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateUrl({ page: page - 1 })}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-[#DDE4DC] bg-white text-[#10271B] hover:bg-[#F2F5EF] disabled:opacity-40 cursor-pointer"
                  aria-label="Önceki Sayfa"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                  let pageNum: number;
                  if (pageCount <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= pageCount - 2) {
                    pageNum = pageCount - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  const isActive = pageNum === page;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => updateUrl({ page: pageNum })}
                      className={`inline-flex size-8 items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isActive
                          ? "bg-[#10271B] text-white"
                          : "border border-[#DDE4DC] bg-white text-[#10271B] hover:bg-[#F2F5EF]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => updateUrl({ page: page + 1 })}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-[#DDE4DC] bg-white text-[#10271B] hover:bg-[#F2F5EF] disabled:opacity-40 cursor-pointer"
                  aria-label="Sonraki Sayfa"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
