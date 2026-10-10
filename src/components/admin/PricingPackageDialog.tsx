"use client";

import { useEffect, useRef, useState } from "react";
import type { BillingBasis, PricingPackageRow } from "@/lib/admin/pricing";
import { createAdminPricingPackage, updateAdminPricingPackage } from "@/lib/admin/pricing";
import { getAdminTcmbEurRate } from "@/lib/admin/tcmb";
import { getTcmbEurRecommendation, type TcmbEurRate } from "@/lib/pricing/tcmb";
import { toast } from "@/components/ui/toast";
import { TrNumberInput } from "@/components/admin/TrNumberInput";
import pages from "./admin-pages.module.css";

// Referans "Yeni Paket Ekle / Paketi Düzenle" (#fp-dialog). İş kuralları önceki
// PricingModal ile aynı: € fiyatı elle girilir (TCMB kuru yalnız öneri), satın
// alınabilir paketlerde € zorunlu ve en fazla 2 ondalık; paket kimliği sonradan
// değiştirilemez. Web sitesi metinleri (EN ad, açıklama, rozet) "Site metinleri"
// bölümünde korunur.

type Form = {
  name: string;
  id: string;
  lessons: string;
  order: string;
  tl: string;
  eur: string;
  active: boolean;
  nameEn: string;
  descTr: string;
  descEn: string;
  badgeTr: string;
  badgeEn: string;
  oldTotal: string;
  discount: string;
};

function initialForm(pkg: PricingPackageRow | null, nextOrder: number): Form {
  const price = pkg ? pkg.current_total ?? pkg.price_amount : null;
  return {
    name: pkg?.name_tr ?? "",
    id: pkg?.id ?? "",
    lessons: pkg?.lesson_count != null ? String(pkg.lesson_count) : "",
    order: String(pkg ? pkg.display_order ?? 0 : nextOrder),
    tl: price != null ? String(price) : "",
    eur: pkg?.price_eur != null ? String(pkg.price_eur) : "",
    active: pkg ? pkg.active : true,
    nameEn: pkg?.name_en ?? "",
    descTr: pkg?.description_tr ?? "",
    descEn: pkg?.description_en ?? "",
    badgeTr: pkg?.badge_tr ?? "",
    badgeEn: pkg?.badge_en ?? "",
    oldTotal: pkg?.old_total != null ? String(pkg.old_total) : "",
    discount: pkg?.discount_percentage != null ? String(pkg.discount_percentage) : "",
  };
}

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));

export function PricingPackageDialog({ pkg, nextOrder, onClose, onSaved }: {
  pkg: PricingPackageRow | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Form>(() => initialForm(pkg, nextOrder));
  const [errors, setErrors] = useState<Partial<Record<"name" | "id" | "tl" | "eur" | "lessons", string>>>({});
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState<TcmbEurRate | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    getAdminTcmbEurRate().then((result) => {
      if (!active) return;
      setRate(result.data);
      setRateError(result.error);
    });
    return () => { active = false; };
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key as keyof typeof current] ? { ...current, [key]: undefined } : current));
  };

  const recommendation = getTcmbEurRecommendation({
    tryAmount: Number(form.tl),
    manualEur: form.eur.trim() ? Number(form.eur.replace(",", ".")) : null,
    eurTryRate: rate?.rate ?? null,
  });

  async function save() {
    if (saving) return;
    const name = form.name.trim();
    const id = form.id.trim().toLowerCase();
    const tl = numberOrNull(form.tl);
    const eurText = form.eur.trim().replace(",", ".");
    const eur = eurText ? Number(eurText) : null;
    const lessons = form.lessons.trim() ? Number(form.lessons) : null;
    const next: typeof errors = {};
    if (!name) next.name = "Paket adını yazın";
    if (!id) next.id = "Paket kimliğini yazın";
    else if (!pkg && !/^[a-z0-9][a-z0-9_-]*$/.test(id)) next.id = "Yalnız küçük harf, rakam, - ve _ kullanın";
    if (tl === null || !Number.isFinite(tl) || tl < 0) next.tl = "Geçerli bir ₺ fiyatı yazın (0 = ücretsiz)";
    if (eur === null || !Number.isFinite(eur) || eur <= 0 || eur > 1_000_000 || !/^\d+(?:\.\d{1,2})?$/.test(eurText)) next.eur = "€ fiyatı pozitif olmalı ve en fazla 2 ondalık içermeli";
    if (lessons !== null && (!Number.isInteger(lessons) || lessons < 1)) next.lessons = "Ders sayısı en az 1 olmalı";
    setErrors(next);
    if (Object.keys(next).length || tl === null || eur === null) return;

    const lessonCount = lessons ?? pkg?.lesson_count ?? 1;
    const priceChanged = !pkg || tl !== (pkg.current_total ?? pkg.price_amount) || lessonCount !== pkg.lesson_count;
    const order = Number(form.order);
    const details = {
      name_tr: name,
      name_en: form.nameEn.trim() || (pkg ? pkg.name_en : null) || name,
      description_tr: form.descTr.trim() || null,
      description_en: form.descEn.trim() || null,
      lesson_count: lessonCount,
      discount_percentage: numberOrNull(form.discount),
      unit_price: priceChanged ? (lessonCount > 0 ? Math.round(tl / lessonCount) : tl) : pkg?.unit_price ?? Math.round(tl / Math.max(1, lessonCount)),
      old_total: numberOrNull(form.oldTotal),
      current_total: tl,
      badge_tr: form.badgeTr.trim() || null,
      badge_en: form.badgeEn.trim() || null,
      purchase_mode: "purchasable" as const,
      price_eur: eur,
    };

    setSaving(true);
    const result = pkg
      ? await updateAdminPricingPackage(pkg.id, {
          price_amount: tl,
          active: form.active,
          display_order: Number.isFinite(order) && order > 0 ? Math.round(order) : 999,
          ...details,
        })
      : await createAdminPricingPackage({
          id,
          price_amount: tl,
          currency: "TRY",
          billing_basis: (lessonCount === 1 ? "session" : "custom") as BillingBasis,
          active: form.active,
          display_order: Number.isFinite(order) && order > 0 ? Math.round(order) : 999,
          ...details,
        });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(pkg ? `${name} güncellendi` : `${name} eklendi`);
    onSaved();
    onClose();
  }

  const field = (key: keyof typeof errors) => `m-field${errors[key] ? " fx-err" : ""}`;
  const err = (key: keyof typeof errors) => (errors[key] ? <span className="m-hint" style={{ color: "#9A3324" }}>{errors[key]}</span> : null);

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog ref={dialogRef} className="fx-dlg" id="fp-dialog" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="fp-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="fp-title" className="m-htitle">{pkg ? "Paketi Düzenle" : "Yeni Paket Ekle"}</h2>
              <span className="m-hsub">Paket web sitesinde ve öğrenci ödeme ekranında görünür.</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" data-close="" onClick={() => dialogRef.current?.close()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body fx-body">
            <div className="fx-grid">
              <div className={field("name")}>
                <label htmlFor="fp-ad" className="m-lab">Paket adı <span className="m-req">*</span></label>
                <input id="fp-ad" className="m-input" placeholder="Örn. 10 Derslik Paket" value={form.name} onChange={(event) => set("name", event.target.value)} />
                {err("name")}
              </div>
              <div className={field("id")}>
                <label htmlFor="fp-id" className="m-lab">Paket kimliği (ID) <span className="m-req">*</span></label>
                <input id="fp-id" className="m-input fx-mono" placeholder="Örn. package10" value={form.id} readOnly={Boolean(pkg)} title={pkg ? "Paket kimliği sonradan değiştirilemez" : undefined} onChange={(event) => set("id", event.target.value)} />
                {err("id")}
              </div>
              <div className={field("lessons")}>
                <label htmlFor="fp-ders" className="m-lab">Ders sayısı</label>
                <div className="m-suffix"><input id="fp-ders" type="number" min="1" className="m-input" placeholder="Tanışma görüşmesinde boş" value={form.lessons} onChange={(event) => set("lessons", event.target.value)} /><span className="m-unit">ders</span></div>
                {err("lessons")}
              </div>
              <div className="m-field">
                <label htmlFor="fp-sira" className="m-lab">Sıra</label>
                <input id="fp-sira" type="number" min="1" className="m-input" placeholder="Örn. 3" value={form.order} onChange={(event) => set("order", event.target.value)} />
              </div>
              <div className={field("tl")}>
                <label htmlFor="fp-tl" className="m-lab">₺ fiyatı <span className="m-req">*</span></label>
                <div className="m-suffix cur"><TrNumberInput id="fp-tl" className="m-input" placeholder="0 = ücretsiz" value={form.tl} onValueChange={(value) => set("tl", value)} /><span className="m-unit">₺</span></div>
                {err("tl")}
              </div>
              <div className={field("eur")}>
                <label htmlFor="fp-eur" className="m-lab">€ fiyatı <span className="m-req">*</span></label>
                <div className="m-suffix cur"><TrNumberInput id="fp-eur" decimals className="m-input" placeholder="0,00" value={form.eur} onValueChange={(value) => set("eur", value)} /><span className="m-unit">€</span></div>
                {err("eur") ?? (
                  <span className="m-hint" aria-live="polite">
                    {rate
                      ? `TCMB: 1 € = ${rate.rate.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺${recommendation.suggestedEur !== null ? ` · Önerilen: €${recommendation.suggestedEur.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${recommendation.status === "review" ? " · fiyatı kontrol edin" : ""}` : ""}`
                      : rateError || "Kur bilgisi alınıyor…"}
                  </span>
                )}
              </div>
            </div>
            <div className="fx-toggles">
              <div className="fx-toggle">
                <span className="fx-tl"><span id="fp-aktif-l">Paket aktif</span><small>Kapalıysa sitede ve ödeme ekranında görünmez.</small></span>
                <button type="button" className="m-sw" role="switch" aria-checked={form.active} aria-labelledby="fp-aktif-l" id="fp-aktif" onClick={() => set("active", !form.active)}><span className="m-knob" /></button>
              </div>
            </div>
            <details className="fx-more">
              <summary>Site metinleri <small>İngilizce ad, açıklama, rozet ve eski fiyat</small></summary>
              <div className="fx-grid">
                <div className="m-field"><label htmlFor="fp-ad-en" className="m-lab">Paket adı (EN)</label><input id="fp-ad-en" className="m-input" placeholder="Örn. 10 Lesson Package" value={form.nameEn} onChange={(event) => set("nameEn", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="fp-eski" className="m-lab">Eski fiyat</label><div className="m-suffix cur"><TrNumberInput id="fp-eski" className="m-input" placeholder="İndirimsiz liste fiyatı" value={form.oldTotal} onValueChange={(value) => set("oldTotal", value)} /><span className="m-unit">₺</span></div></div>
                <div className="m-field"><label htmlFor="fp-acik" className="m-lab">Açıklama (TR)</label><input id="fp-acik" className="m-input" value={form.descTr} onChange={(event) => set("descTr", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="fp-acik-en" className="m-lab">Açıklama (EN)</label><input id="fp-acik-en" className="m-input" value={form.descEn} onChange={(event) => set("descEn", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="fp-rozet" className="m-lab">Rozet (TR)</label><input id="fp-rozet" className="m-input" placeholder="Örn. En çok tercih edilen" value={form.badgeTr} onChange={(event) => set("badgeTr", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="fp-rozet-en" className="m-lab">Rozet (EN)</label><input id="fp-rozet-en" className="m-input" placeholder="Örn. Most popular" value={form.badgeEn} onChange={(event) => set("badgeEn", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="fp-indirim" className="m-lab">İndirim oranı</label><div className="m-suffix"><input id="fp-indirim" type="number" min="0" max="100" className="m-input" value={form.discount} onChange={(event) => set("discount", event.target.value)} /><span className="m-unit">%</span></div></div>
              </div>
            </details>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" data-close="" onClick={() => dialogRef.current?.close()}>Vazgeç</button>
            <button type="button" className="m-save" disabled={saving} onClick={() => void save()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <span>{saving ? "Kaydediliyor…" : pkg ? "Kaydet" : "Paketi Ekle"}</span>
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
