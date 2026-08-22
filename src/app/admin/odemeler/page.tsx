"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Tag, WalletCards } from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { listAdminPayments, reviewManualBankTransfer, type AdminPaymentRow } from "@/lib/admin/payments";

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Bekliyor", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  requires_action: { label: "Doğrulama Gerekli", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  processing: { label: "İşleniyor", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  paid: { label: "Ödendi", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  failed: { label: "Başarısız", bg: "bg-rose-50 border-rose-200", text: "text-rose-800" },
  cancelled: { label: "İptal", bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-700" },
  refunded: { label: "İade", bg: "bg-purple-50 border-purple-200", text: "text-purple-800" },
};

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState("");
  const [error, setError] = useState("");

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

  async function review(row: AdminPaymentRow, decision: "approved" | "rejected") {
    const prompt =
      decision === "approved"
        ? `"${row.payer_name || row.payer_email}" adlı öğrencinin "${row.public_reference}" numaralı havale tahsilatını onaylıyor musunuz? Bu işlem paketi otomatik olarak etkinleştirecektir.`
        : `"${row.public_reference}" numaralı havale talebini reddetmek istediğinize emin misiniz?`;
    if (!window.confirm(prompt)) return;
    setReviewing(row.id);
    const r = await reviewManualBankTransfer(row.id, decision);
    setReviewing("");
    if (r.error) setError(r.error);
    else void load();
  }

  function money(amount: number, currency = "TRY") {
    try {
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#DDE4DC] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold text-[#10271B]">Ödemeler / Payments</h1>
          </div>
          <p className="mt-1 text-xs text-[#68756C]">
            Öğrenci paket satın alma ve ödeme işlemlerini inceleyin; manuel havaleleri doğrulayarak sonuçlandırın.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#DDE4DC] bg-white px-3 text-xs font-semibold text-[#10271B] hover:bg-[#F2F5EF]"
        >
          <RefreshCw className="size-3.5" />
          Yenile
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#DDE4DC] bg-white p-12">
          <AdminWaveStatus label="Ödemeler yükleniyor…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDE4DC] bg-white p-12 text-center text-xs text-[#68756C]">
          Henüz ödeme kaydı bulunmuyor.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#DDE4DC] bg-white">
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
                  <th className="px-4 py-3.5">Tarih</th>
                  <th className="px-4 py-3.5">Referans / İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE4DC]">
                {rows.map((row) => {
                  const meta = row.metadata ?? {};
                  const couponCode = meta.coupon_code;
                  const discountAmount = meta.discount_amount ? Number(meta.discount_amount) : 0;
                  const baseAmount = meta.base_amount ? Number(meta.base_amount) : row.amount;
                  const st = statusLabels[row.status] || { label: row.status, bg: "bg-surface-muted", text: "text-ink" };
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
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-[#68756C]">
                        {new Date(row.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-[11px] text-[#10271B]">{row.public_reference}</span>
                        {reviewable && (
                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              disabled={reviewing === row.id}
                              onClick={() => void review(row, "approved")}
                              className="rounded-lg bg-[#10271B] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-[#203D2D] disabled:opacity-50"
                            >
                              {reviewing === row.id ? "İşleniyor…" : "Tahsilatı Onayla"}
                            </button>
                            <button
                              type="button"
                              disabled={reviewing === row.id}
                              onClick={() => void review(row, "rejected")}
                              className="rounded-lg border border-[#DDE4DC] px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Reddet
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-5 text-[#68756C]">
        Kart numarası, CVV veya banka parolası saklanmaz. Kart işlemleri bu panelden manuel olarak ödendi durumuna getirilemez.
        Tüm tahsilat onaylama ve reddetme işlemleri sistem denetim kaydına yazılır.
      </p>
    </div>
  );
}
