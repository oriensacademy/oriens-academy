"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/lib/data/query-store";
import type { PricingPackageRow } from "@/lib/admin/pricing";
import { deleteAdminPricingPackage, listAdminPricingPackages, updateAdminPricingPackage } from "@/lib/admin/pricing";
import { PricingPackageDialog } from "@/components/admin/PricingPackageDialog";
import { FxConfirmDialog } from "@/components/admin/FxConfirmDialog";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

// Referans Fiyatlandırma (#view-fiyat): paket tablosu, Durum anahtarı, düzenle / sil.
// Paket silme mevcut admin_delete_pricing_package akışıyla yapılır; geçmiş satın
// almalar ve ödeme kayıtları etkilenmez.

const EMPTY_PACKAGES: PricingPackageRow[] = [];

const fxTL = (n: number) => `₺${n.toLocaleString("tr-TR")}`;
const fxEUR = (n: number) => `€${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const packageName = (pkg: PricingPackageRow) => pkg.name_tr?.trim() || pkg.name_en?.trim() || pkg.id;

function EditIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}

function DeleteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;
}

export default function AdminPricingPage() {
  const { data, loading, refetch } = useQuery("admin:pricing", listAdminPricingPackages, { staleTime: 30_000 });
  const packages = data?.data ?? EMPTY_PACKAGES;
  const loadError = data?.error || "";
  const [editing, setEditing] = useState<PricingPackageRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<PricingPackageRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => packages.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.id.localeCompare(b.id)), [packages]);
  const activeCount = packages.filter((pkg) => pkg.active).length;
  const nextOrder = useMemo(() => {
    const orders = packages.map((pkg) => pkg.display_order ?? 0).filter((order) => order < 999);
    return orders.length ? Math.max(...orders) + 1 : 1;
  }, [packages]);

  async function toggle(pkg: PricingPackageRow) {
    setBusyId(pkg.id);
    const { success, error } = await updateAdminPricingPackage(pkg.id, { active: !pkg.active });
    setBusyId(null);
    if (!success) {
      toast.error(error || "Paket durumu değiştirilemedi.");
      return;
    }
    toast.success(`${packageName(pkg)} ${pkg.active ? "pasife alındı" : "aktif edildi"}`);
    await refetch();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const pkg = deleting;
    setBusyId(pkg.id);
    const { success, error } = await deleteAdminPricingPackage(pkg.id);
    setBusyId(null);
    if (!success) {
      toast.error(error || "Paket silinemedi.");
      return;
    }
    setDeleting(null);
    toast.success(`${packageName(pkg)} silindi`);
    await refetch();
  }

  return (
    <div id="view-fiyat" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>Fiyatlandırma</h1><p>Ders paketlerini, ₺ ve € fiyatlarını, satış durumunu ve sitedeki sıralamasını yönetin.</p></div>
          <button type="button" className="fx-btn primary" onClick={() => setEditing("new")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Yeni Paket Ekle
          </button>
        </div>
        <section className="card">
          <table className="fx-table" aria-label="Fiyat paketleri" hidden={!sorted.length}>
            <colgroup><col style={{ width: "28%" }} /><col style={{ width: "19%" }} /><col style={{ width: "19%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: 96 }} /></colgroup>
            <thead><tr><th>Paket</th><th>₺ fiyatı</th><th>€ fiyatı</th><th>Sıra</th><th>Durum</th><th><span className="sr">İşlemler</span></th></tr></thead>
            <tbody id="fp-rows">
              {sorted.map((pkg) => {
                const name = packageName(pkg);
                const tl = Number(pkg.current_total ?? pkg.price_amount ?? 0);
                const order = pkg.display_order ?? 0;
                return (
                  <tr key={pkg.id} className={pkg.active ? undefined : "off"}>
                    <td className="fx-name"><b>{name}</b><small>{pkg.id}</small></td>
                    <td className="fx-price">{tl ? fxTL(tl) : <span className="fx-tag ok">Ücretsiz</span>}</td>
                    <td className="fx-price">{pkg.price_eur ? fxEUR(Number(pkg.price_eur)) : !tl ? <span className="fx-tag ok">Ücretsiz</span> : <span className="fx-muted">—</span>}</td>
                    <td><span className="fx-sira" title={order >= 999 ? "Listenin sonunda gösterilir (sıra 999)" : undefined}>{order >= 999 ? "Son" : order}</span></td>
                    <td>
                      <span className="fx-swl">
                        <button type="button" className="m-sw fx-sw" role="switch" aria-checked={pkg.active} aria-label={`${name} aktif`} disabled={busyId === pkg.id} onClick={() => void toggle(pkg)}><span className="m-knob" /></button>
                        <em className={pkg.active ? "on" : undefined}>{pkg.active ? "Aktif" : "Pasif"}</em>
                      </span>
                    </td>
                    <td>
                      <div className="fx-act">
                        <button type="button" className="fx-ib" title="Düzenle" aria-label={`${name} düzenle`} onClick={() => setEditing(pkg)}><EditIcon /></button>
                        <button type="button" className="fx-ib del" title="Sil" aria-label={`${name} sil`} disabled={busyId === pkg.id} onClick={() => setDeleting(pkg)}><DeleteIcon /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!sorted.length ? (
            <div className="fx-empty">
              <b>{loading && !data ? "Paketler yükleniyor…" : loadError ? "Paketler yüklenemedi" : "Henüz paket yok"}</b>
              {loading && !data ? null : <span>{loadError || "Sağ üstteki “Yeni Paket Ekle” ile ilk paketi oluşturun."}</span>}
            </div>
          ) : null}
          <div className="foot"><span id="fp-shown">{packages.length} paket · {activeCount} aktif</span><span>Sıra, paketlerin web sitesinde gösterilme sırasıdır</span></div>
        </section>
      </div></div>

      {editing ? (
        <PricingPackageDialog
          key={editing === "new" ? "new" : editing.id}
          pkg={editing === "new" ? null : editing}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
          onSaved={() => void refetch()}
        />
      ) : null}

      {deleting ? (
        <FxConfirmDialog
          title="Paket silinsin mi?"
          sub={packageName(deleting)}
          text="Paket fiyat listesinden kaldırılır. Bu paketi daha önce satın almış öğrencilerin paketleri ve ödeme kayıtları etkilenmez. Yalnızca satıştan kaldırmak için Durum anahtarını kapatabilirsiniz."
          ok="Paketi sil"
          busy={busyId === deleting.id}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
