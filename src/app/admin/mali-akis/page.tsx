"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  FilterX,
  PiggyBank,
  RefreshCw,
  Search,
  Tag,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import {
  getAdminFinancialMetrics,
  listAdminPaymentsPaginated,
  type AdminFinancialMetrics,
  type AdminPaymentRow,
} from "@/lib/admin/payments";
import { formatCurrency } from "@/lib/format/currency";

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  paid: { label: "Ödendi", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  pending: { label: "Bekliyor", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  requires_action: { label: "Doğrulama Gerekli", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  processing: { label: "İşleniyor", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  refunded: { label: "İade", bg: "bg-purple-50 border-purple-200", text: "text-purple-800" },
  failed: { label: "Başarısız", bg: "bg-rose-50 border-rose-200", text: "text-rose-800" },
  cancelled: { label: "İptal", bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-700" },
};

function formatMoney(amount: number, currency = "TRY") {
  return formatCurrency(amount, { currency, locale: "tr" });
}

export default function AdminFinancialFlowPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Read filters from URL
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.max(10, Math.min(100, Number(searchParams.get("pageSize") || "25")));
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const paymentMethod = searchParams.get("paymentMethod") || "all";
  const packageId = searchParams.get("packageId") || "all";
  const period = (searchParams.get("period") as "all" | "today" | "last_7_days" | "last_30_days" | "this_month" | "this_year") || "all";

  const [searchInput, setSearchInput] = useState(search);
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [uniquePackages, setUniquePackages] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [metrics, setMetrics] = useState<AdminFinancialMetrics>({
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
  });
  const [loading, setLoading] = useState(true);
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
    Promise.all([
      listAdminPaymentsPaginated({
        page,
        pageSize,
        search,
        status,
        paymentMethod,
        packageId,
        period,
      }),
      getAdminFinancialMetrics({
        search,
        status,
        paymentMethod,
        packageId,
        period,
      }),
    ]).then(([listRes, metricsRes]) => {
      if (!active) return;
      setRows(listRes.data);
      setTotalCount(listRes.totalCount);
      setPageCount(listRes.pageCount || 1);
      setMetrics(metricsRes.metrics);
      if (metricsRes.uniquePackages?.length > 0) {
        setUniquePackages(metricsRes.uniquePackages);
      }
      setError(listRes.error || metricsRes.error || "");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [page, pageSize, search, status, paymentMethod, packageId, period, refreshTrigger]);

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
    search || status !== "all" || paymentMethod !== "all" || packageId !== "all" || period !== "all"
  );

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(totalCount, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-6 text-primary" />
            <h1 className="text-xl font-bold text-ink">Mali Akış</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Akademinin tüm paket tahsilatlarını, kupon indirimlerini ve finansal akışını sunucu taraflı izleyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="size-4 shrink-0 text-red-600" />
          {error}
        </div>
      )}

      {/* Financial Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          title="Toplam Tahsilat"
          value={formatMoney(metrics.totalCollected)}
          subtext={`${metrics.paidPackagesCount} tamamlanan işlem`}
          icon={PiggyBank}
          accent="emerald"
        />
        <MetricCard
          title="Bu Ay Tahsilat"
          value={formatMoney(metrics.currentMonthCollected)}
          subtext="Cari ay cirosu"
          icon={TrendingUp}
          accent="primary"
        />
        <MetricCard
          title="Bekleyen Ödemeler"
          value={formatMoney(metrics.totalPendingAmount)}
          subtext={`${metrics.pendingCount} işlem beklemede`}
          icon={WalletCards}
          accent="amber"
        />
        <MetricCard
          title="Toplam Kupon İndirimi"
          value={formatMoney(metrics.totalDiscountGiven)}
          subtext="Kullanılan promosyon"
          icon={Tag}
          accent="slate"
        />
        <MetricCard
          title="İade Edilen"
          value={formatMoney(metrics.refundedAmount)}
          subtext={`${metrics.refundedCount} iade kaydı`}
          icon={ArrowDownRight}
          accent="purple"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Öğrenci, e-posta, referans veya kupon kodu ara…"
              className="min-h-9 w-full rounded-lg border border-input pl-9 pr-3 text-xs text-ink focus:border-primary focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors"
          >
            Filtrele
          </button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 pt-1 border-t border-border/50">
          <select
            value={status}
            onChange={(e) => updateUrl({ status: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
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

          <select
            value={paymentMethod}
            onChange={(e) => updateUrl({ paymentMethod: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
          >
            <option value="all">Tüm Yöntemler</option>
            <option value="card">Kredi / Banka Kartı</option>
          </select>

          <select
            value={packageId}
            onChange={(e) => updateUrl({ packageId: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
          >
            <option value="all">Tüm Paketler</option>
            {uniquePackages.map((pkg) => (
              <option key={pkg} value={pkg}>
                {pkg}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => updateUrl({ period: e.target.value, page: 1 })}
            className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
          >
            <option value="all">Tüm Zamanlar</option>
            <option value="today">Bugün</option>
            <option value="last_7_days">Son 7 Gün</option>
            <option value="last_30_days">Son 30 Gün</option>
            <option value="this_month">Bu Ay</option>
            <option value="this_year">Bu Yıl</option>
          </select>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
            >
              <FilterX className="size-3.5" />
              Filtreleri Sıfırla
            </button>
          ) : (
            <div className="hidden lg:block text-right self-center text-[11px] text-muted-foreground">
              Toplam <strong>{totalCount}</strong> işlem
            </div>
          )}
        </div>
      </div>

      {/* Filter Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-1">
        <div>
          Kayıtlar: <strong className="text-ink">{startRecord}–{endRecord}</strong> / {totalCount} işlem
        </div>
        <div className="flex items-center gap-3">
          <div>
            Filtrelenen Hacim: <strong className="text-ink text-sm font-bold">{formatMoney(metrics.filteredTotalVolume)}</strong>
          </div>
          <div className="flex items-center gap-1.5 pl-3 border-l border-border">
            <label className="text-[11px] text-muted-foreground">Sayfa Başına:</label>
            <select
              value={pageSize}
              onChange={(e) => updateUrl({ pageSize: Number(e.target.value), page: 1 })}
              className="rounded-lg border border-input bg-white px-2 py-1 text-xs text-ink"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Ledger Table */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-white p-12">
          <AdminWaveStatus label="Mali kayıtlar yükleniyor…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-xs text-muted-foreground">
          {hasActiveFilters
            ? "Filtrelere uygun finansal işlem kaydı bulunamadı. Lütfen filtrelerinizi kontrol edin."
            : "Henüz mali kayıt bulunmuyor."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="border-b border-border bg-[#F9FAF8] text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3.5">İşlem / Referans</th>
                  <th className="px-4 py-3.5">Öğrenci</th>
                  <th className="px-4 py-3.5">Paket</th>
                  <th className="px-4 py-3.5">Baz Fiyat</th>
                  <th className="px-4 py-3.5">Kupon / İndirim</th>
                  <th className="px-4 py-3.5">Net Tahsilat</th>
                  <th className="px-4 py-3.5">Ödeme Yöntemi</th>
                  <th className="px-4 py-3.5">Durum</th>
                  <th className="px-4 py-3.5">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const meta = row.metadata ?? {};
                  const couponCode = meta.coupon_code;
                  const discountAmount = Number(meta.discount_amount) || 0;
                  const baseAmount = Number(meta.base_amount) || row.amount;
                  const st = statusConfig[row.status] || {
                    label: row.status,
                    bg: "bg-surface-muted",
                    text: "text-ink",
                  };

                  return (
                    <tr key={row.id} className="hover:bg-[#F7F9F6] transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-ink">{row.public_reference}</span>
                        <span className="block text-[10px] text-muted-foreground">{row.provider}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <strong className="block text-ink">{row.payer_name || "—"}</strong>
                        <span className="text-[10px] text-muted-foreground">{row.payer_email || "—"}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-medium text-ink">{row.package_id}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {formatMoney(baseAmount, row.currency)}
                      </td>
                      <td className="px-4 py-3.5">
                        {couponCode ? (
                          <div className="flex items-center gap-1 font-semibold text-emerald-800">
                            <Tag className="size-3" />
                            <span>{couponCode}</span>
                            <span>(-{formatMoney(discountAmount, row.currency)})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-sm text-ink">
                          {formatMoney(row.amount, row.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-muted-foreground">
                        {row.payment_method === "bank_transfer" ? "Banka Havalesi / EFT" : "Kredi / Banka Kartı"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-muted-foreground">
                        <div>{new Date(row.created_at).toLocaleDateString("tr-TR")}</div>
                        <div className="text-[10px]">{new Date(row.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          {pageCount > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-[#F9FAF8] text-xs">
              <div className="text-muted-foreground">
                Sayfa <strong>{page}</strong> / {pageCount} (Toplam {totalCount} işlem)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateUrl({ page: page - 1 })}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white text-ink hover:bg-surface-muted disabled:opacity-40 cursor-pointer"
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
                          ? "bg-ink text-white"
                          : "border border-border bg-white text-ink hover:bg-surface-muted"
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
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white text-ink hover:bg-surface-muted disabled:opacity-40 cursor-pointer"
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

function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtext: string;
  icon: typeof PiggyBank;
  accent: "emerald" | "primary" | "amber" | "slate" | "purple";
}) {
  const accentStyles = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    primary: "text-primary bg-sage-soft border-border-strong",
    amber: "text-amber-800 bg-amber-50 border-amber-200",
    slate: "text-slate-700 bg-slate-50 border-slate-200",
    purple: "text-purple-700 bg-purple-50 border-purple-200",
  }[accent];

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <span className={`flex size-8 items-center justify-center rounded-lg border ${accentStyles}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 font-sans text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtext}</p>
    </div>
  );
}
