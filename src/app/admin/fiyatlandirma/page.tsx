"use client";

import { useState, useEffect, useCallback } from "react";
import { PricingModal } from "@/components/admin/PricingModal";
import type { PricingPackageRow } from "@/lib/admin/pricing";
import {
  listAdminPricingPackages,
  updateAdminPricingPackage,
  deleteAdminPricingPackage,
} from "@/lib/admin/pricing";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  CreditCard,
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
  Inbox,
} from "lucide-react";

import { formatCurrency } from "@/lib/format/currency";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";

export default function AdminPricingPage() {
  return <PricingContent />;
}

function PricingContent() {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [packages, setPackages] = useState<PricingPackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PricingPackageRow | null>(null);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminPricingPackages();
    setLoading(false);
    if (error) setErrorMsg(error);
    else setPackages(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);
      listAdminPricingPackages().then(({ data, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) setErrorMsg(error);
          else setPackages(data);
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleToggleActive = async (pkg: PricingPackageRow) => {
    const { success, error } = await updateAdminPricingPackage(pkg.id, {
      active: !pkg.active,
    });
    if (error) setErrorMsg(error);
    else if (success) fetchPackages();
  };

  const handleDelete = (id: string) => {
    requestConfirmation({
      title: "Fiyat paketini sil",
      description: `"${id}" fiyat paketi kalıcı olarak silinecek. İlişkili satışlar varsa veritabanı işlemi güvenli biçimde reddedecektir.`,
      action: async () => {
        setDeletingId(id);
        const { success, error } = await deleteAdminPricingPackage(id);
        setDeletingId(null);
        if (error) setErrorMsg(error);
        else if (success) await fetchPackages();
      },
    });
  };

  return (
    <div className="space-y-6">
      {confirmationDialog}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Fiyat Paketleri Yönetimi
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ders paketleri, seans fiyatları ve öne çıkan üyelik seçeneklerini yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPackages}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
          >
            {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingPackage(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4" />
            <span>Yeni Paket Ekle</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={fetchPackages}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Fiyat paketleri yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && packages.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Henüz Fiyat Paketi Bulunmuyor
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Veritabanında kayıtlı fiyat paketi yok. &quot;Yeni Paket Ekle&quot; butonunu kullanarak ilk seans veya paket seçeneğini oluşturabilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingPackage(null);
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4" />
            <span>İlk Paketi Oluştur</span>
          </button>
        </div>
      )}

      {/* Package List (Desktop Table) */}
      {!loading && !errorMsg && packages.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Paket Kimliği (ID)</th>
                  <th className="px-4 py-3">Fiyat & Para Birimi</th>
                  <th className="px-4 py-3">Faturalandırma Basis</th>
                  <th className="px-4 py-3">Satın Alma</th>
                  <th className="px-4 py-3">Sıralama</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="transition-colors hover:bg-background-soft/80"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{pkg.id}</span>
                        {pkg.featured && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Sparkles className="size-3 text-amber-600" />
                            <span>Öne Çıkan</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-[#10271B]">
                      {pkg.price_amount !== null
                        ? formatCurrency(pkg.price_amount, { currency: pkg.currency || "TRY", locale: "tr" })
                        : "Özel Fiyatlandırma"}
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground">
                      <span className="capitalize">{pkg.billing_basis}</span>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground">
                      {pkg.purchase_mode === "purchasable" ? "Satın alınabilir" : "Görüşme"}
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground font-mono">
                      {pkg.display_order}
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(pkg)}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          pkg.active
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        <CheckCircle2 className="size-3" />
                        <span>{pkg.active ? "Aktif" : "Pasif"}</span>
                      </button>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPackage(pkg);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="size-3 text-muted-foreground" />
                        <span>Düzenle</span>
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === pkg.id}
                        onClick={() => handleDelete(pkg.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === pkg.id ? (
                          <Wave className="h-3 w-6" aria-label="Siliniyor" />
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                        <span>Sil</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <PricingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPackage(null);
        }}
        onSaved={fetchPackages}
        editingPackage={editingPackage}
      />
    </div>
  );
}
