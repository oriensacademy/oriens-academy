"use client";

import { useMemo, useState } from "react";
import { invalidate, useQuery } from "@/lib/data/query-store";
import { deleteAdminCoupon, listAdminCoupons, toggleAdminCouponActive } from "@/lib/coupons/client";
import type { DiscountCoupon } from "@/lib/coupons/types";
import { listAdminPricingPackages, type PricingPackageRow } from "@/lib/admin/pricing";
import { CouponDialog, packageLabel } from "@/components/admin/CouponDialog";
import { FxConfirmDialog } from "@/components/admin/FxConfirmDialog";
import { foldTurkish } from "@/lib/format/turkish";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "İndirim Kuponları" (#view-kupon). Kupon doğrulama, PayTR tutarı ve
// kullanım sayımı sunucu tarafında kalır; bu ekran yalnız kupon kayıtlarını yönetir.

type Durum = "aktif" | "pasif" | "bitti";

const EMPTY_COUPONS: DiscountCoupon[] = [];
const EMPTY_PACKAGES: PricingPackageRow[] = [];
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const fxTL = (n: number) => `₺${n.toLocaleString("tr-TR")}`;
const fxGun = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${AY[d.getMonth()]} ${d.getFullYear()}`;
};

function couponDurum(coupon: DiscountCoupon, now: Date): Durum {
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return "bitti";
  if (coupon.max_total_uses && coupon.used_count >= coupon.max_total_uses) return "bitti";
  return coupon.active ? "aktif" : "pasif";
}

const DURUM_TAG: Record<Durum, { cls: string; label: string }> = {
  aktif: { cls: "ok", label: "Aktif" },
  pasif: { cls: "off", label: "Pasif" },
  bitti: { cls: "warn", label: "Süresi doldu" },
};

function EditIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}

function DeleteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;
}

async function loadCoupons() {
  const [couponRes, pkgRes] = await Promise.all([listAdminCoupons(), listAdminPricingPackages()]);
  return { coupons: couponRes.data, packages: pkgRes.data || [], error: couponRes.error || "" };
}

export default function AdminCouponsPage() {
  const { data, loading } = useQuery("admin:coupons", loadCoupons, { staleTime: 30_000 });
  const coupons = data?.coupons ?? EMPTY_COUPONS;
  const packages = data?.packages ?? EMPTY_PACKAGES;
  const loadError = data?.error || "";

  const [q, setQ] = useState("");
  const [tur, setTur] = useState("");
  const [durum, setDurum] = useState("");
  const [editing, setEditing] = useState<DiscountCoupon | "new" | null>(null);
  const [deleting, setDeleting] = useState<DiscountCoupon | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const packageNames = useMemo(() => new Map(packages.map((pkg) => [pkg.id, packageLabel(pkg)])), [packages]);

  const rows = useMemo(() => {
    const now = new Date();
    return coupons.map((coupon) => ({ coupon, durum: couponDurum(coupon, now) }));
  }, [coupons]);

  const visible = useMemo(() => {
    const query = foldTurkish(q.trim());
    return rows.filter(({ coupon, durum: d }) => {
      if (query && !foldTurkish(`${coupon.code} ${coupon.name ?? ""}`).includes(query)) return false;
      if (tur && (coupon.discount_type === "percentage" ? "yuzde" : "sabit") !== tur) return false;
      return !durum || d === durum;
    });
  }, [rows, q, tur, durum]);

  const kpi = useMemo(() => ({
    toplam: rows.length,
    aktif: rows.filter((row) => row.durum === "aktif").length,
    kullanim: coupons.reduce((sum, coupon) => sum + (coupon.used_count || 0), 0),
  }), [rows, coupons]);

  async function toggle(coupon: DiscountCoupon) {
    setBusyId(coupon.id);
    const { error } = await toggleAdminCouponActive(coupon.id, !coupon.active);
    setBusyId(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${coupon.code} ${coupon.active ? "pasife alındı" : "aktif edildi"}`);
    invalidate("admin:coupons");
  }

  async function confirmDelete() {
    if (!deleting) return;
    const coupon = deleting;
    setBusyId(coupon.id);
    const { error } = await deleteAdminCoupon(coupon.id);
    setBusyId(null);
    if (error) {
      toast.error(error);
      return;
    }
    setDeleting(null);
    toast.success(`${coupon.code} silindi`);
    invalidate("admin:coupons");
  }

  const has = coupons.length > 0;

  return (
    <div id="view-kupon" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>İndirim Kuponları</h1><p>Ödeme ve kayıt sırasında kullanılacak kuponları, limitlerini ve geçerli paketlerini yönetin.</p></div>
          <button type="button" className="fx-btn primary" data-kp-new="" onClick={() => setEditing("new")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Yeni Kupon Oluştur
          </button>
        </div>

        <div className="stats fx-stats3">
          <div className="stat"><span className="l">Toplam kupon</span><b data-k="toplam">{kpi.toplam}</b><span className="s">oluşturulan tüm kuponlar</span></div>
          <div className="stat"><span className="l">Aktif kupon</span><b data-k="aktif">{kpi.aktif}</b><span className="s">şu an kullanılabilir</span></div>
          <div className="stat"><span className="l">Toplam kullanım</span><b data-k="kullanim">{kpi.kullanim}</b><span className="s">kez kullanıldı</span></div>
        </div>

        <section className="card">
          <div className="tools">
            <label className="search">
              <span className="sr">Kupon ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" id="kp-q" placeholder="Kupon kodu veya kampanya adı ara…" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <label>
              <span className="sr">Tür</span>
              <select className="sel" id="kp-tur" value={tur} onChange={(event) => setTur(event.target.value)}>
                <option value="">Tüm türler</option><option value="sabit">Sabit tutar (₺)</option><option value="yuzde">Yüzdelik (%)</option>
              </select>
            </label>
            <label>
              <span className="sr">Durum</span>
              <select className="sel" id="kp-durum" value={durum} onChange={(event) => setDurum(event.target.value)}>
                <option value="">Tüm durumlar</option><option value="aktif">Aktif</option><option value="pasif">Pasif</option><option value="bitti">Süresi dolmuş</option>
              </select>
            </label>
          </div>

          <table className="fx-table" id="kp-table" aria-label="İndirim kuponları" hidden={!visible.length}>
            <colgroup><col style={{ width: "22%" }} /><col style={{ width: "12%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "16%" }} /><col style={{ width: "10%" }} /><col style={{ width: 96 }} /></colgroup>
            <thead><tr><th>Kupon</th><th>İndirim</th><th>Geçerli paketler</th><th>Kullanım</th><th>Geçerlilik</th><th>Durum</th><th><span className="sr">İşlemler</span></th></tr></thead>
            <tbody id="kp-rows">
              {visible.map(({ coupon, durum: d }) => {
                const isPct = coupon.discount_type === "percentage";
                const alt = [
                  isPct && coupon.maximum_discount_amount ? `en fazla ${fxTL(coupon.maximum_discount_amount)}` : "",
                  coupon.minimum_order_amount ? `en az ${fxTL(coupon.minimum_order_amount)} sepet` : "",
                ].filter(Boolean).join(" · ");
                const pkgIds = coupon.package_ids ?? [];
                const tag = DURUM_TAG[d];
                return (
                  <tr key={coupon.id} className={d === "aktif" ? undefined : "off"}>
                    <td className="fx-name">
                      <b className="fx-mono">{coupon.code}{coupon.first_purchase_only ? <span className="fx-tag grey">İlk alım</span> : null}</b>
                      <small style={{ fontFamily: "inherit" }}>{coupon.name || "Kampanya adı yok"}</small>
                    </td>
                    <td className="fx-use"><b>{isPct ? `%${coupon.discount_value}` : fxTL(coupon.discount_value)}</b>{alt ? <small>{alt}</small> : null}</td>
                    <td>
                      <div className="fx-pk">
                        {pkgIds.length ? pkgIds.map((id) => <span key={id} className="fx-tag grey">{packageNames.get(id) ?? id}</span>) : <span className="fx-muted">Tüm paketler</span>}
                      </div>
                    </td>
                    <td className="fx-use"><b>{coupon.used_count} / {coupon.max_total_uses || "∞"}</b><small>{coupon.max_uses_per_student ? `öğrenci başına ${coupon.max_uses_per_student}` : "öğrenci başına sınırsız"}</small></td>
                    <td className="fx-date">{coupon.valid_from ? fxGun(coupon.valid_from) : "—"}<small>{coupon.valid_until ? `${fxGun(coupon.valid_until)} bitiş` : "Süresiz"}</small></td>
                    <td>
                      <span className="fx-swl" title={d === "bitti" ? tag.label : undefined}>
                        <button type="button" className="m-sw fx-sw" role="switch" aria-checked={coupon.active} aria-label={`${coupon.code} aktif`} data-kp-toggle={coupon.code} disabled={busyId === coupon.id} onClick={() => void toggle(coupon)}><span className="m-knob" /></button>
                        <em className={coupon.active ? "on" : undefined}>{coupon.active ? "Aktif" : "Pasif"}</em>
                      </span>
                    </td>
                    <td>
                      <div className="fx-act">
                        <button type="button" className="fx-ib" title="Düzenle" aria-label={`${coupon.code} düzenle`} onClick={() => setEditing(coupon)}><EditIcon /></button>
                        <button type="button" className="fx-ib del" title="Sil" aria-label={`${coupon.code} sil`} data-kp-del={coupon.code} disabled={busyId === coupon.id} onClick={() => setDeleting(coupon)}><DeleteIcon /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && !data ? (
            <div className="fx-empty" id="kp-empty"><b>Kuponlar yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="kp-empty" hidden={visible.length > 0}>
              <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg></span>
              <b data-kp-empty-t="">{loadError ? "Kuponlar yüklenemedi" : has ? "Sonuç bulunamadı" : "Henüz kupon yok"}</b>
              <span data-kp-empty-s="">{loadError || (has ? "Aramayı veya filtreleri değiştirmeyi deneyin." : "Sağ üstteki “Yeni Kupon Oluştur” ile ilk kuponunuzu ekleyin.")}</span>
            </div>
          )}

          <div className="foot" id="kp-foot" hidden={!has}><span id="kp-shown">{visible.length} / {coupons.length} kupon gösteriliyor</span><span>Kuponlar ödeme sayfasında kod ile kullanılır</span></div>
        </section>
      </div></div>

      {editing ? (
        <CouponDialog
          key={editing === "new" ? "new" : editing.id}
          coupon={editing === "new" ? null : editing}
          coupons={coupons}
          packages={packages}
          onClose={() => setEditing(null)}
          onSaved={() => invalidate("admin:coupons")}
        />
      ) : null}

      {deleting ? (
        <FxConfirmDialog
          title="Kupon silinsin mi?"
          sub={deleting.code}
          text="Kupon kalıcı olarak silinir ve artık ödeme sırasında kullanılamaz. Daha önce bu kuponla yapılmış ödemeler etkilenmez. Geçici olarak durdurmak için Durum anahtarını kapatabilirsiniz."
          ok="Kuponu sil"
          busy={busyId === deleting.id}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
