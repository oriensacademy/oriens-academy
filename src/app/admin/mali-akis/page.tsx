"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  Landmark,
  PiggyBank,
  RefreshCw,
  Search,
  Tag,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { listAdminPayments, type AdminPaymentRow } from "@/lib/admin/payments";

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
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function AdminFinancialFlowPage() {
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await listAdminPayments();
    setRows(r.data);
    setError(r.error || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    listAdminPayments().then((r) => {
      if (!active) return;
      setRows(r.data);
      setError(r.error || "");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Compute Financial Dashboard Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalCollected = 0;
    let totalPendingAmount = 0;
    let pendingCount = 0;
    let bankTransferPendingAmount = 0;
    let bankTransferPendingCount = 0;
    let paidPackagesCount = 0;
    let refundedAmount = 0;
    let refundedCount = 0;
    let currentMonthCollected = 0;
    let totalDiscountGiven = 0;

    rows.forEach((r) => {
      const amount = Number(r.amount) || 0;
      const meta = r.metadata ?? {};
      const discount = Number(meta.discount_amount) || 0;
      totalDiscountGiven += discount;

      const date = new Date(r.paid_at || r.created_at);
      const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;

      if (r.status === "paid") {
        totalCollected += amount;
        paidPackagesCount += 1;
        if (isThisMonth) {
          currentMonthCollected += amount;
        }
      } else if (r.status === "pending" || r.status === "requires_action" || r.status === "processing") {
        totalPendingAmount += amount;
        pendingCount += 1;
        if (r.payment_method === "bank_transfer") {
          bankTransferPendingAmount += amount;
          bankTransferPendingCount += 1;
        }
      } else if (r.status === "refunded") {
        refundedAmount += amount;
        refundedCount += 1;
      }
    });

    return {
      totalCollected,
      totalPendingAmount,
      pendingCount,
      bankTransferPendingAmount,
      bankTransferPendingCount,
      paidPackagesCount,
      refundedAmount,
      refundedCount,
      currentMonthCollected,
      totalDiscountGiven,
    };
  }, [rows]);

  // Extract unique packages
  const uniquePackages = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.package_id).filter(Boolean))).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    const now = new Date();

    return rows.filter((r) => {
      const meta = r.metadata ?? {};
      const searchable = [
        r.payer_name || "",
        r.payer_email || "",
        r.payer_phone || "",
        r.public_reference || "",
        r.package_id || "",
        meta.coupon_code || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesMethod = methodFilter === "all" || r.payment_method === methodFilter;
      const matchesPackage = packageFilter === "all" || r.package_id === packageFilter;

      let matchesPeriod = true;
      if (periodFilter !== "all") {
        const itemDate = new Date(r.created_at);
        if (periodFilter === "this_month") {
          matchesPeriod =
            itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (periodFilter === "last_30_days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesPeriod = itemDate >= thirtyDaysAgo;
        } else if (periodFilter === "this_year") {
          matchesPeriod = itemDate.getFullYear() === now.getFullYear();
        }
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesPackage && matchesPeriod;
    });
  }, [rows, search, statusFilter, methodFilter, packageFilter, periodFilter]);

  const filteredTotalVolume = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-6 text-primary" />
            <h1 className="text-xl font-bold text-ink">Mali Akış / Financial Overview</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Akademinin tüm paket tahsilatlarını, bekleyen havalelerini, kupon indirimlerini ve finansal akışını canlı izleyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" />
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
          title="Banka Havalesi Bekleyen"
          value={formatMoney(metrics.bankTransferPendingAmount)}
          subtext={`${metrics.bankTransferPendingCount} manuel havale onayı`}
          icon={Landmark}
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
      <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_160px_160px]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <span className="sr-only">İşlem ara</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Öğrenci, e-posta, referans veya kupon ara…"
            className="min-h-9 w-full rounded-lg border border-input pl-9 pr-3 text-xs focus:border-primary focus:outline-hidden"
          />
        </label>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="paid">Ödendi (Paid)</option>
          <option value="pending">Bekliyor (Pending)</option>
          <option value="requires_action">Doğrulama Gerekli</option>
          <option value="processing">İşleniyor</option>
          <option value="refunded">İade (Refunded)</option>
          <option value="failed">Başarısız (Failed)</option>
        </select>

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
        >
          <option value="all">Tüm Yöntemler</option>
          <option value="bank_transfer">Banka Havalesi / EFT</option>
          <option value="card">Kredi / Banka Kartı</option>
        </select>

        <select
          value={packageFilter}
          onChange={(e) => setPackageFilter(e.target.value)}
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
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="min-h-9 rounded-lg border border-input bg-white px-2.5 text-xs text-ink focus:border-primary focus:outline-hidden"
        >
          <option value="all">Tüm Zamanlar</option>
          <option value="this_month">Bu Ay</option>
          <option value="last_30_days">Son 30 Gün</option>
          <option value="this_year">Bu Yıl</option>
        </select>
      </div>

      {/* Filter Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-1">
        <div>
          Gösterilen: <strong className="text-ink">{filteredRows.length}</strong> / {rows.length} işlem
        </div>
        <div>
          Filtrelenen Hacim: <strong className="text-ink text-sm font-bold">{formatMoney(filteredTotalVolume)}</strong>
        </div>
      </div>

      {/* Financial Ledger Table */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-white p-12">
          <AdminWaveStatus label="Mali kayıtlar yükleniyor…" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-xs text-muted-foreground">
          Filtrelere uygun finansal işlem kaydı bulunamadı.
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
                {filteredRows.map((row) => {
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
      <div className="mt-3 font-heading text-2xl font-bold text-ink">{value}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtext}</p>
    </div>
  );
}
