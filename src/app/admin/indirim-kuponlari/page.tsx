"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  listAdminCoupons,
  toggleAdminCouponActive,
  updateAdminCoupon,
} from "@/lib/coupons/client";
import { formatCurrency } from "@/lib/format/currency";
import type {
  CreateCouponInput,
  DiscountCoupon,
  UpdateCouponInput,
} from "@/lib/coupons/types";
import { listAdminPricingPackages, type PricingPackageRow } from "@/lib/admin/pricing";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";

export default function AdminCouponsPage() {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);
  const [packages, setPackages] = useState<PricingPackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "percentage" | "fixed">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountCoupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form State
  const [form, setForm] = useState<{
    code: string;
    name: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    currency: string;
    minimum_order_amount: string;
    maximum_discount_amount: string;
    max_total_uses: string;
    max_uses_per_student: string;
    valid_from: string;
    valid_until: string;
    active: boolean;
    first_purchase_only: boolean;
    package_ids: string[];
  }>({
    code: "",
    name: "",
    discount_type: "percentage",
    discount_value: 10,
    currency: "TRY",
    minimum_order_amount: "",
    maximum_discount_amount: "",
    max_total_uses: "",
    max_uses_per_student: "1",
    valid_from: "",
    valid_until: "",
    active: true,
    first_purchase_only: false,
    package_ids: [],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [couponRes, pkgRes] = await Promise.all([listAdminCoupons(), listAdminPricingPackages()]);
    if (couponRes.error) setError(couponRes.error);
    else setCoupons(couponRes.data);
    setPackages(pkgRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listAdminCoupons(), listAdminPricingPackages()]).then(([couponRes, pkgRes]) => {
      if (!active) return;
      if (couponRes.error) setError(couponRes.error);
      else setCoupons(couponRes.data);
      setPackages(pkgRes.data || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const packageMap = useMemo(() => {
    const map = new Map<string, string>();
    packages.forEach((p) => map.set(p.id, p.name_tr || p.name_en || p.id));
    return map;
  }, [packages]);

  function openCreateModal() {
    setEditingCoupon(null);
    setForm({
      code: "",
      name: "",
      discount_type: "percentage",
      discount_value: 15,
      currency: "TRY",
      minimum_order_amount: "",
      maximum_discount_amount: "",
      max_total_uses: "",
      max_uses_per_student: "1",
      valid_from: "",
      valid_until: "",
      active: true,
      first_purchase_only: false,
      package_ids: [],
    });
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(coupon: DiscountCoupon) {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      name: coupon.name || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      currency: coupon.currency || "TRY",
      minimum_order_amount: coupon.minimum_order_amount !== null ? String(coupon.minimum_order_amount) : "",
      maximum_discount_amount: coupon.maximum_discount_amount !== null ? String(coupon.maximum_discount_amount) : "",
      max_total_uses: coupon.max_total_uses !== null ? String(coupon.max_total_uses) : "",
      max_uses_per_student: coupon.max_uses_per_student !== null ? String(coupon.max_uses_per_student) : "",
      valid_from: coupon.valid_from ? coupon.valid_from.substring(0, 16) : "",
      valid_until: coupon.valid_until ? coupon.valid_until.substring(0, 16) : "",
      active: coupon.active,
      first_purchase_only: coupon.first_purchase_only,
      package_ids: coupon.package_ids || [],
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSaveCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) {
      setFormError("Kupon kodu zorunludur.");
      return;
    }
    if (form.discount_value <= 0) {
      setFormError("İndirim değeri sıfırdan büyük olmalıdır.");
      return;
    }
    if (form.discount_type === "percentage" && form.discount_value > 100) {
      setFormError("Yüzdelik indirim %100'den büyük olamaz.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: CreateCouponInput = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim() || undefined,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      currency: form.currency,
      minimum_order_amount: form.minimum_order_amount ? Number(form.minimum_order_amount) : null,
      maximum_discount_amount: form.maximum_discount_amount ? Number(form.maximum_discount_amount) : null,
      max_total_uses: form.max_total_uses ? parseInt(form.max_total_uses, 10) : null,
      max_uses_per_student: form.max_uses_per_student ? parseInt(form.max_uses_per_student, 10) : null,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      active: form.active,
      first_purchase_only: form.first_purchase_only,
      package_ids: form.package_ids,
    };

    if (editingCoupon) {
      const res = await updateAdminCoupon({ id: editingCoupon.id, ...payload });
      setSaving(false);
      if (res.error) setFormError(res.error);
      else {
        setModalOpen(false);
        void loadData();
      }
    } else {
      const res = await createAdminCoupon(payload);
      setSaving(false);
      if (res.error) setFormError(res.error);
      else {
        setModalOpen(false);
        void loadData();
      }
    }
  }

  async function handleToggleActive(coupon: DiscountCoupon) {
    const nextStatus = !coupon.active;
    const res = await toggleAdminCouponActive(coupon.id, nextStatus);
    if (!res.error) {
      setCoupons((current) =>
        current.map((c) => (c.id === coupon.id ? { ...c, active: nextStatus } : c))
      );
    }
  }

  function handleDelete(coupon: DiscountCoupon) {
    requestConfirmation({
      title: "Kuponu sil",
      description: `"${coupon.code}" kodlu kupon kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      action: async () => {
        const res = await deleteAdminCoupon(coupon.id);
        if (!res.error) setCoupons((current) => current.filter((c) => c.id !== coupon.id));
        else setError(res.error);
      },
    });
  }

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const codeMatch = c.code.toLowerCase().includes(q);
        const nameMatch = c.name?.toLowerCase().includes(q) ?? false;
        if (!codeMatch && !nameMatch) return false;
      }
      if (filterType !== "all" && c.discount_type !== filterType) return false;
      if (filterStatus === "active" && !c.active) return false;
      if (filterStatus === "inactive" && c.active) return false;
      return true;
    });
  }, [coupons, search, filterType, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: coupons.length,
      active: coupons.filter((c) => c.active).length,
      totalRedemptions: coupons.reduce((sum, c) => sum + (c.used_count || 0), 0),
    };
  }, [coupons]);

  function money(val: number, cur = "TRY") {
    return formatCurrency(val, { currency: cur, locale: "tr" });
  }

  return (
    <div className="space-y-6">
      {confirmationDialog}
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-[#DDE4DC] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold text-[#10271B]">İndirim Kuponları</h1>
          </div>
          <p className="mt-1 text-xs text-[#68756C]">
            Öğrenci ödeme ve kayıt süreçlerinde kullanılacak indirim kuponlarını ve paket hedeflerini yönetin.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#DDE4DC] bg-white px-3 text-xs font-semibold text-[#10271B] hover:bg-[#F2F5EF]"
          >
            <RefreshCw className="size-3.5" />
            Yenile
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#10271B] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#203D2D]"
          >
            <Plus className="size-4" />
            Yeni Kupon Oluştur
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#DDE4DC] bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68756C]">Toplam Kupon</span>
          <p className="mt-2 text-2xl font-bold text-[#10271B]">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-[#DDE4DC] bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68756C]">Aktif Kuponlar</span>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-[#DDE4DC] bg-white p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68756C]">Toplam Kullanım</span>
          <p className="mt-2 text-2xl font-bold text-[#10271B]">{stats.totalRedemptions} kez</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#DDE4DC] bg-white p-3.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#68756C]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kupon kodu veya adı ara…"
            className="min-h-9 w-full rounded-lg border border-[#DDE4DC] bg-transparent pl-9 pr-3 text-xs text-[#10271B] outline-none focus:border-[#819586]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | "percentage" | "fixed")}
            className="min-h-9 rounded-lg border border-[#DDE4DC] bg-white px-2.5 text-xs text-[#10271B] outline-none"
          >
            <option value="all">Tüm Türler</option>
            <option value="percentage">Yüzdelik (%)</option>
            <option value="fixed">Sabit Tutar (TL)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
            className="min-h-9 rounded-lg border border-[#DDE4DC] bg-white px-2.5 text-xs text-[#10271B] outline-none"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Yalnızca Aktif</option>
            <option value="inactive">Yalnızca Pasif</option>
          </select>
        </div>
      </div>

      {/* Coupons Table */}
      {loading ? (
        <div className="rounded-2xl border border-[#DDE4DC] bg-white p-12">
          <AdminWaveStatus label="Kuponlar yükleniyor…" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DDE4DC] bg-white p-12 text-center text-xs text-[#68756C]">
          Kupon bulunamadı. Yeni bir kupon oluşturabilirsiniz.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#DDE4DC] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead className="border-b border-[#DDE4DC] bg-[#F9FAF8] text-[10px] uppercase tracking-wider text-[#68756C]">
                <tr>
                  <th className="px-4 py-3.5">Kod</th>
                  <th className="px-4 py-3.5">Tür & Değer</th>
                  <th className="px-4 py-3.5">Kullanım / Limit</th>
                  <th className="px-4 py-3.5">Geçerlilik Tarihi</th>
                  <th className="px-4 py-3.5">Hedef Paketler</th>
                  <th className="px-4 py-3.5">Koşullar</th>
                  <th className="px-4 py-3.5">Durum</th>
                  <th className="px-4 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE4DC]">
                {filteredCoupons.map((c) => {
                  const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
                  const isExhausted = c.max_total_uses !== null && c.used_count >= c.max_total_uses;
                  return (
                    <tr key={c.id} className="hover:bg-[#F7F9F6] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#10271B] tracking-wide">{c.code}</span>
                        </div>
                        {c.name && <p className="mt-0.5 text-[11px] text-[#68756C]">{c.name}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF2EC] px-2 py-0.5 font-bold text-[#10271B]">
                          {c.discount_type === "percentage" ? `%${c.discount_value}` : money(c.discount_value, c.currency)}
                        </span>
                        {c.maximum_discount_amount && (
                          <p className="mt-0.5 text-[10px] text-[#68756C]">
                            Maks. indirim: {money(c.maximum_discount_amount, c.currency)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-[#10271B]">{c.used_count}</span>
                        <span className="text-[#68756C]"> / {c.max_total_uses ?? "Sınırsız"}</span>
                        {c.max_uses_per_student && (
                          <p className="text-[10px] text-[#68756C]">Kişi başı: {c.max_uses_per_student}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-[#68756C]">
                        {c.valid_from || c.valid_until ? (
                          <div>
                            <p>{c.valid_from ? new Date(c.valid_from).toLocaleDateString("tr-TR") : "Başlangıç yok"}</p>
                            <p>{c.valid_until ? `— ${new Date(c.valid_until).toLocaleDateString("tr-TR")}` : "— Süresiz"}</p>
                          </div>
                        ) : (
                          "Süresiz"
                        )}
                        {isExpired && <span className="mt-1 block text-[10px] font-bold text-amber-700">Süresi doldu</span>}
                        {isExhausted && <span className="mt-1 block text-[10px] font-bold text-rose-700">Limit doldu</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.package_ids && c.package_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {c.package_ids.map((id) => (
                              <span key={id} className="rounded bg-[#EFF2ED] px-1.5 py-0.5 text-[10px] text-[#10271B]">
                                {packageMap.get(id) || id}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#68756C]">Tüm Paketler</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[11px]">
                        {c.first_purchase_only && (
                          <span className="block text-emerald-800 font-medium">• İlk paket alımı</span>
                        )}
                        {c.minimum_order_amount && (
                          <span className="block text-[#68756C]">Min: {money(c.minimum_order_amount, c.currency)}</span>
                        )}
                        {!c.first_purchase_only && !c.minimum_order_amount && (
                          <span className="text-[#68756C]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(c)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                            c.active
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                          }`}
                        >
                          {c.active ? "Aktif" : "Pasif"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="rounded-lg p-1.5 text-[#68756C] hover:bg-[#EEF2EC] hover:text-[#10271B]"
                            title="Düzenle"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            title="Sil"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#DDE4DC] bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-5 top-5 rounded-lg p-1 text-[#68756C] hover:bg-[#F2F5EF]"
            >
              <X className="size-5" />
            </button>

            <h2 className="text-xl font-bold text-[#10271B]">
              {editingCoupon ? "İndirim Kuponunu Düzenle" : "Yeni İndirim Kuponu Oluştur"}
            </h2>
            <p className="mt-1 text-xs text-[#68756C]">
              Kupon kodunu, indirim oranını, kullanım limitlerini ve geçerli paketleri belirleyin.
            </p>

            {formError && (
              <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCoupon} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">
                    Kupon Kodu <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Örn: ORIENS20, YAZ2026"
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 font-mono text-xs uppercase outline-none focus:border-[#819586]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Kampanya / Kupon Adı</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Örn: Yeni Öğrenci Hoş Geldin İndirimi"
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">İndirim Türü</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) =>
                      setForm({ ...form, discount_type: e.target.value as "percentage" | "fixed" })
                    }
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  >
                    <option value="percentage">Yüzdelik İndirim (%)</option>
                    <option value="fixed">Sabit Tutar İndirimi (TL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">
                    {form.discount_type === "percentage" ? "İndirim Oranı (%)" : "İndirim Tutarı (TL)"}{" "}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={form.discount_type === "percentage" ? "100" : "1000000"}
                    required
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Maksimum İndirim Tutarı (Opsiyonel)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Sınırsız için boş bırakın"
                    value={form.maximum_discount_amount}
                    onChange={(e) => setForm({ ...form, maximum_discount_amount: e.target.value })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Minimum Sepet Tutarı (Opsiyonel)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Sınırsız için boş bırakın"
                    value={form.minimum_order_amount}
                    onChange={(e) => setForm({ ...form, minimum_order_amount: e.target.value })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Toplam Kullanım Limiti</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Sınırsız için boş bırakın"
                    value={form.max_total_uses}
                    onChange={(e) => setForm({ ...form, max_total_uses: e.target.value })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Öğrenci Başına Kullanım Limiti</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Varsayılan: 1"
                    value={form.max_uses_per_student}
                    onChange={(e) => setForm({ ...form, max_uses_per_student: e.target.value })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Başlangıç Tarihi</label>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#10271B]">Bitiş Tarihi</label>
                  <input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-[#DDE4DC] px-3 text-xs outline-none focus:border-[#819586]"
                  />
                </div>
              </div>

              {/* Package Targeting */}
              <div>
                <label className="block text-xs font-semibold text-[#10271B]">
                  Geçerli Eğitim Paketleri (Boş bırakılırsa tüm paketlerde geçerlidir)
                </label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 max-h-36 overflow-y-auto rounded-xl border border-[#DDE4DC] p-3 bg-[#F9FAF8]">
                  {packages.map((pkg) => {
                    const isChecked = form.package_ids.includes(pkg.id);
                    return (
                      <label key={pkg.id} className="flex items-center gap-2 text-xs text-[#10271B] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, package_ids: [...form.package_ids, pkg.id] });
                            } else {
                              setForm({
                                ...form,
                                package_ids: form.package_ids.filter((id) => id !== pkg.id),
                              });
                            }
                          }}
                          className="size-3.5 rounded accent-[#10271B]"
                        />
                        <span className="truncate">{pkg.name_tr || pkg.name_en || pkg.id}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#DDE4DC]">
                <label className="flex items-center gap-2 text-xs font-medium text-[#10271B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.first_purchase_only}
                    onChange={(e) => setForm({ ...form, first_purchase_only: e.target.checked })}
                    className="size-4 rounded accent-[#10271B]"
                  />
                  <span>Yalnızca ilk kez eğitim paketi satın alacak öğrenciler için geçerli olsun</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#10271B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="size-4 rounded accent-[#10271B]"
                  />
                  <span>Kupon aktif olarak kullanıma sunulsun</span>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#DDE4DC]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#DDE4DC] px-4 py-2 text-xs font-semibold text-[#10271B] hover:bg-[#F2F5EF]"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#10271B] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#203D2D] disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor…" : editingCoupon ? "Değişiklikleri Kaydet" : "Kuponu Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
