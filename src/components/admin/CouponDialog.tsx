"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateCouponInput, DiscountCoupon } from "@/lib/coupons/types";
import { createAdminCoupon, updateAdminCoupon } from "@/lib/coupons/client";
import type { PricingPackageRow } from "@/lib/admin/pricing";
import { RefDatePicker } from "@/components/admin/RefDatePicker";
import { toast } from "@/components/ui/toast";
import { TrNumberInput } from "@/components/admin/TrNumberInput";
import pages from "./admin-pages.module.css";

// Referans "Yeni İndirim Kuponu" (#kp-dialog). Tarihler veritabanında UTC ISO
// olarak durur; formda yerel gün + saat olarak gösterilir ve kaydederken yerel
// saatten ISO'ya çevrilir (önceki sürüm UTC değeri yerel saat gibi okuyordu).

type Tur = "yuzde" | "sabit";

type Form = {
  code: string;
  name: string;
  tur: Tur;
  value: string;
  max: string;
  min: string;
  limit: string;
  perStudent: string;
  fromDay: string;
  fromTime: string;
  untilDay: string;
  untilTime: string;
  packageIds: string[];
  firstOnly: boolean;
  active: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isoToLocalParts(value: string | null): { day: string; time: string } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { day: dayKey(date), time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}

export function localPartsToIso(day: string, time: string): string | null {
  if (!day) return null;
  const date = new Date(`${day}T${time || "00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const packagePrice = (pkg: PricingPackageRow) => Number(pkg.current_total ?? pkg.price_amount ?? 0);
export const packageLabel = (pkg: PricingPackageRow) => pkg.name_tr?.trim() || pkg.name_en?.trim() || pkg.id;

// Referans kpIndirim: yüzdelik indirim "en fazla" ile sınırlanır; indirim paket
// fiyatını aşamaz.
export function couponDiscount(price: number, tur: Tur, value: number, max: number | null) {
  let amount = tur === "yuzde" ? (price * value) / 100 : value;
  if (tur === "yuzde" && max != null && max > 0) amount = Math.min(amount, max);
  return Math.max(0, Math.min(Math.round(amount), price));
}

function initialForm(coupon: DiscountCoupon | null): Form {
  const from = isoToLocalParts(coupon?.valid_from ?? null);
  const until = isoToLocalParts(coupon?.valid_until ?? null);
  const str = (n: number | null | undefined) => (n == null ? "" : String(n));
  return {
    code: coupon?.code ?? "",
    name: coupon?.name ?? "",
    tur: coupon ? (coupon.discount_type === "fixed" ? "sabit" : "yuzde") : "yuzde",
    value: coupon ? String(coupon.discount_value) : "15",
    max: str(coupon?.maximum_discount_amount),
    min: str(coupon?.minimum_order_amount),
    limit: str(coupon?.max_total_uses),
    perStudent: coupon ? str(coupon.max_uses_per_student) : "1",
    fromDay: coupon ? from?.day ?? "" : dayKey(new Date()),
    fromTime: coupon ? from?.time ?? "00:00" : "00:00",
    untilDay: until?.day ?? "",
    untilTime: until?.time ?? "23:59",
    packageIds: coupon?.package_ids ?? [],
    firstOnly: coupon?.first_purchase_only ?? false,
    active: coupon ? coupon.active : true,
  };
}

const fxTL = (n: number) => `₺${n.toLocaleString("tr-TR")}`;

export function CouponDialog({ coupon, coupons, packages, onClose, onSaved }: {
  coupon: DiscountCoupon | null;
  coupons: DiscountCoupon[];
  packages: PricingPackageRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Form>(() => initialForm(coupon));
  const [errors, setErrors] = useState<Partial<Record<"code" | "value" | "limit" | "perStudent" | "until", string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    const errKey = key === "untilDay" ? "until" : key;
    setErrors((current) => (current[errKey as keyof typeof current] ? { ...current, [errKey]: undefined } : current));
  };

  // Satın alınabilir paketler; düzenlenen kuponun mevcut eşleşmeleri pasif olsa da korunur.
  const chipPackages = useMemo(() => {
    const selected = new Set(coupon?.package_ids ?? []);
    return packages
      .filter((pkg) => (pkg.active && packagePrice(pkg) > 0) || selected.has(pkg.id))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [packages, coupon]);

  const previewPkg = useMemo(() => {
    const pool = chipPackages.filter((pkg) => packagePrice(pkg) > 0);
    const chosen = form.packageIds.length ? pool.filter((pkg) => form.packageIds.includes(pkg.id)) : pool;
    return chosen.find((pkg) => pkg.badge_tr) ?? chosen[0] ?? null;
  }, [chipPackages, form.packageIds]);

  const value = Number(form.value.replace(",", "."));
  const max = form.max.trim() ? Number(form.max.replace(",", ".")) : null;
  const preview = previewPkg && Number.isFinite(value) && value > 0
    ? (() => {
        const price = packagePrice(previewPkg);
        const off = couponDiscount(price, form.tur, value, max);
        return { name: packageLabel(previewPkg), price, off, net: price - off };
      })()
    : null;

  function togglePackage(id: string) {
    set("packageIds", form.packageIds.includes(id) ? form.packageIds.filter((x) => x !== id) : [...form.packageIds, id]);
  }

  function normalizeCode(raw: string) {
    return raw.toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
  }

  async function save() {
    if (saving) return;
    const code = normalizeCode(form.code);
    const next: typeof errors = {};
    if (!code) next.code = "Kupon kodunu yazın";
    else if (coupons.some((c) => c.id !== coupon?.id && c.code.toUpperCase() === code)) next.code = "Bu kupon kodu zaten var";
    if (!Number.isFinite(value) || value <= 0) next.value = "İndirim sıfırdan büyük olmalı";
    else if (form.tur === "yuzde" && value > 100) next.value = "Yüzdelik indirim %100'den büyük olamaz";
    const limit = form.limit.trim() ? Number(form.limit) : null;
    const perStudent = form.perStudent.trim() ? Number(form.perStudent) : null;
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) next.limit = "En az 1 olmalı";
    if (perStudent !== null && (!Number.isInteger(perStudent) || perStudent < 1)) next.perStudent = "En az 1 olmalı";
    const validFrom = localPartsToIso(form.fromDay, form.fromTime);
    const validUntil = localPartsToIso(form.untilDay, form.untilTime);
    if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) next.until = "Bitiş tarihi başlangıçtan sonra olmalı";
    setErrors(next);
    if (Object.keys(next).length) return;

    const num = (text: string) => (text.trim() ? Number(text.replace(",", ".")) : null);
    const payload: CreateCouponInput = {
      code,
      name: form.name.trim(),
      discount_type: form.tur === "sabit" ? "fixed" : "percentage",
      discount_value: value,
      currency: coupon?.currency || "TRY",
      minimum_order_amount: num(form.min),
      maximum_discount_amount: form.tur === "yuzde" ? num(form.max) : null,
      max_total_uses: limit,
      max_uses_per_student: perStudent,
      valid_from: validFrom,
      valid_until: validUntil,
      active: form.active,
      first_purchase_only: form.firstOnly,
      package_ids: form.packageIds,
    };

    setSaving(true);
    const error = coupon
      ? (await updateAdminCoupon({ id: coupon.id, ...payload })).error
      : (await createAdminCoupon(payload)).error;
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(coupon ? `${code} güncellendi` : `${code} kuponu oluşturuldu`);
    onSaved();
    onClose();
  }

  const field = (key: keyof typeof errors) => `m-field${errors[key] ? " fx-err" : ""}`;
  const err = (key: keyof typeof errors) => (errors[key] ? <span className="m-hint" style={{ color: "#9A3324" }}>{errors[key]}</span> : null);
  const isPct = form.tur === "yuzde";

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog ref={dialogRef} className="fx-dlg" id="kp-dialog" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="kp-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="kp-title" className="m-htitle">{coupon ? "Kuponu Düzenle" : "Yeni İndirim Kuponu"}</h2>
              <span className="m-hsub">Kod, indirim, kullanım limitleri ve geçerli paketler</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" data-close="" onClick={() => dialogRef.current?.close()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body fx-body">
            <section className="fx-sec">
              <h3 className="fx-sh">Kupon</h3>
              <div className="fx-grid">
                <div className={field("code")}>
                  <label htmlFor="kp-kod" className="m-lab">Kupon kodu <span className="m-req">*</span></label>
                  <input id="kp-kod" className="m-input fx-mono fx-upper" placeholder="Örn. ORIENS20" maxLength={24} autoComplete="off" value={form.code} onChange={(event) => set("code", normalizeCode(event.target.value))} />
                  {err("code")}
                </div>
                <div className="m-field">
                  <label htmlFor="kp-ad" className="m-lab">Kampanya adı <span className="m-opt">(isteğe bağlı)</span></label>
                  <input id="kp-ad" className="m-input" placeholder="Örn. Yeni öğrenci indirimi" value={form.name} onChange={(event) => set("name", event.target.value)} />
                </div>
              </div>
            </section>

            <section className="fx-sec">
              <h3 className="fx-sh">İndirim</h3>
              <div className="fx-grid">
                <div className="m-field">
                  <span className="m-lab" id="kp-tur-l">İndirim türü</span>
                  <div className="m-dur" role="radiogroup" aria-labelledby="kp-tur-l">
                    <label><input type="radio" name="kp-tur" value="sabit" checked={form.tur === "sabit"} onChange={() => set("tur", "sabit")} /><span>Sabit tutar (₺)</span></label>
                    <label><input type="radio" name="kp-tur" value="yuzde" checked={isPct} onChange={() => set("tur", "yuzde")} /><span>Yüzdelik (%)</span></label>
                  </div>
                </div>
                <div className={field("value")}>
                  <label htmlFor="kp-deger" className="m-lab">{isPct ? "İndirim oranı" : "İndirim tutarı"} <span className="m-req">*</span></label>
                  <div className={isPct ? "m-suffix" : "m-suffix cur"}><TrNumberInput id="kp-deger" className="m-input" value={form.value} onValueChange={(value) => set("value", value)} /><span className="m-unit">{isPct ? "%" : "₺"}</span></div>
                  {err("value")}
                </div>
                <div className="m-field" style={isPct ? undefined : { visibility: "hidden" }} aria-hidden={!isPct}>
                  <label htmlFor="kp-max" className="m-lab">En fazla indirim <span className="m-opt">(isteğe bağlı)</span></label>
                  <div className="m-suffix cur"><TrNumberInput id="kp-max" className="m-input" placeholder="Sınırsız" tabIndex={isPct ? undefined : -1} value={form.max} onValueChange={(value) => set("max", value)} /><span className="m-unit">₺</span></div>
                </div>
                <div className="m-field">
                  <label htmlFor="kp-min" className="m-lab">En az sepet tutarı <span className="m-opt">(isteğe bağlı)</span></label>
                  <div className="m-suffix cur"><TrNumberInput id="kp-min" className="m-input" placeholder="Sınırsız" value={form.min} onValueChange={(value) => set("min", value)} /><span className="m-unit">₺</span></div>
                </div>
              </div>
              <div className="fx-preview" data-kp-preview="">
                {preview ? <>Örnek: {preview.name} <s>{fxTL(preview.price)}</s> → <b>{fxTL(preview.net)}</b> ({fxTL(preview.off)} indirim)</> : null}
              </div>
            </section>

            <section className="fx-sec">
              <h3 className="fx-sh">Kullanım ve geçerlilik</h3>
              <div className="fx-grid">
                <div className={field("limit")}>
                  <label htmlFor="kp-limit" className="m-lab">Toplam kullanım limiti</label>
                  <input id="kp-limit" type="number" min="1" className="m-input" placeholder="Sınırsız" value={form.limit} onChange={(event) => set("limit", event.target.value)} />
                  {err("limit")}
                </div>
                <div className={field("perStudent")}>
                  <label htmlFor="kp-ogr" className="m-lab">Öğrenci başına limit</label>
                  <input id="kp-ogr" type="number" min="1" className="m-input" placeholder="Sınırsız" value={form.perStudent} onChange={(event) => set("perStudent", event.target.value)} />
                  {err("perStudent")}
                </div>
                <div className="m-field">
                  <label htmlFor="kp-bas" className="m-lab">Başlangıç tarihi</label>
                  <RefDatePicker id="kp-bas" value={form.fromDay} emptyLabel="Hemen" onChange={(day) => set("fromDay", day)} />
                </div>
                <div className={field("until")}>
                  <label htmlFor="kp-bit" className="m-lab">Bitiş tarihi <button type="button" className="fx-link" data-kp-suresiz="" onClick={() => set("untilDay", "")}>Süresiz yap</button></label>
                  <RefDatePicker id="kp-bit" value={form.untilDay} emptyLabel="Süresiz" onChange={(day) => set("untilDay", day)} />
                  {err("until")}
                </div>
              </div>
              <div className="m-field">
                <span className="m-lab" id="kp-pk-l">Geçerli paketler <span className="m-opt">(hiçbiri seçilmezse tüm paketlerde geçerli)</span></span>
                <div className="fx-chips" role="group" aria-labelledby="kp-pk-l" id="kp-paketler">
                  {chipPackages.map((pkg) => (
                    <button key={pkg.id} type="button" aria-pressed={form.packageIds.includes(pkg.id)} onClick={() => togglePackage(pkg.id)}>{packageLabel(pkg)}</button>
                  ))}
                </div>
              </div>
              <div className="fx-toggles">
                <div className="fx-toggle">
                  <span className="fx-tl"><span id="kp-ilk-l">Yalnızca ilk paket alımında</span><small>İlk kez paket satın alacak öğrenciler kullanabilir.</small></span>
                  <button type="button" className="m-sw" role="switch" aria-checked={form.firstOnly} aria-labelledby="kp-ilk-l" id="kp-ilk" onClick={() => set("firstOnly", !form.firstOnly)}><span className="m-knob" /></button>
                </div>
                <div className="fx-toggle">
                  <span className="fx-tl"><span id="kp-aktif-l">Kupon aktif</span><small>Kapalıysa kod ödeme sırasında kabul edilmez.</small></span>
                  <button type="button" className="m-sw" role="switch" aria-checked={form.active} aria-labelledby="kp-aktif-l" id="kp-aktif" onClick={() => set("active", !form.active)}><span className="m-knob" /></button>
                </div>
              </div>
            </section>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" data-close="" onClick={() => dialogRef.current?.close()}>Vazgeç</button>
            <button type="button" className="m-save" data-kp-save="" disabled={saving} onClick={() => void save()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <span>{saving ? "Kaydediliyor…" : coupon ? "Kaydet" : "Kuponu Oluştur"}</span>
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
