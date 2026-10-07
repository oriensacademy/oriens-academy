"use client";

import { useEffect, useRef, useState } from "react";
import {
  archiveAdminTestimonial,
  createAdminTestimonial,
  setAdminTestimonialFeatured,
  updateAdminTestimonial,
  type TestimonialRow,
} from "@/lib/admin/content";
import { RefDatePicker } from "@/components/admin/RefDatePicker";
import { toast } from "@/components/ui/toast";
import { compareTr } from "@/lib/format/turkish";
import pages from "@/components/admin/admin-pages.module.css";

// Referans "Yeni Yorum / Yorumu Düzenle" penceresi (#dg-dialog). Ana sayfa
// seçimi mevcut güvenli mantıkla yürür: yalnızca aktif, doğrulanmış ve
// arşivlenmemiş yorumlar `set_testimonial_featured` ile (en fazla 20) ana
// sayfaya alınır; sıra `pin_order` ile tutulur. Kaynaktan aktarılan yorumların
// yazar, metin ve konu bilgisi değiştirilmez.

export const DG_MAX = 20;
export const DG_KATEGORILER = ["İlköğretim Takviye", "Lise Takviye", "Sınav Hazırlık", "Üniversite Takviye", "IB / Uluslararası"];

/** `context` alanı "Kategori - Konu" biçiminde tutulur (kaynak aktarımıyla aynı). */
export function splitContext(context: string | null | undefined) {
  const value = (context ?? "").trim();
  const at = value.indexOf(" - ");
  if (at >= 0) return { kat: value.slice(0, at).trim(), konu: value.slice(at + 3).trim() };
  if (DG_KATEGORILER.includes(value)) return { kat: value, konu: "" };
  return { kat: "", konu: value };
}

function joinContext(kat: string, konu: string) {
  const topic = konu.trim();
  if (!kat) return topic || null;
  return topic ? `${kat} - ${topic}` : kat;
}

export const isImportedReview = (row: TestimonialRow) => Boolean(row.source_hash || row.imported_from_source);
export const isOnHome = (row: TestimonialRow) => row.featured && row.active && row.verified && !row.archived_at;

/** Ana sayfadaki sıra: genel sorgudaki (get_public_testimonials_v2) sıralamanın aynısı. */
export function homeList(rows: TestimonialRow[]) {
  const nullsLast = (a: number | null, b: number | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b);
  return rows.filter(isOnHome).sort((a, b) =>
    nullsLast(a.pin_order, b.pin_order)
    || (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "")
    || a.display_order - b.display_order
    || b.created_at.localeCompare(a.created_at)
    || a.id.localeCompare(b.id));
}

/** Ana sayfa listesini 1..N olarak yazar; yalnızca değişen satırlar güncellenir. */
export async function persistHomeOrder(ordered: TestimonialRow[]) {
  for (const [index, row] of ordered.entries()) {
    if (row.pin_order === index + 1) continue;
    const { error } = await updateAdminTestimonial(row.id, { pin_order: index + 1 });
    if (error) return error;
  }
  return null;
}

export async function addReviewToHome(row: TestimonialRow, current: TestimonialRow[]) {
  if (!row.active || !row.verified) {
    const { error } = await updateAdminTestimonial(row.id, { active: true, verified: true });
    if (error) return error;
  }
  const { error } = await setAdminTestimonialFeatured(row.id, true);
  if (error) return error;
  return persistHomeOrder([...current.filter((item) => item.id !== row.id), row]);
}

export async function removeReviewFromHome(row: TestimonialRow, current: TestimonialRow[]) {
  const { error } = await setAdminTestimonialFeatured(row.id, false);
  if (error) return error;
  const cleared = await updateAdminTestimonial(row.id, { pin_order: null });
  if (cleared.error) return cleared.error;
  return persistHomeOrder(current.filter((item) => item.id !== row.id));
}

export async function archiveReview(row: TestimonialRow, current: TestimonialRow[]) {
  const { error } = await archiveAdminTestimonial(row.id);
  if (error) return error;
  return isOnHome(row) ? removeReviewFromHome(row, current) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const dayToIso = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
};

export function ReviewDialog({ review, rows, onClose, onSaved }: {
  review: TestimonialRow | null;
  rows: TestimonialRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const locked = review ? isImportedReview(review) : false;
  const initial = splitContext(review?.context);
  const initialDay = review ? localDay(new Date(review.created_at)) : localDay(new Date());

  const [ad, setAd] = useState(review?.name ?? "");
  const [kat, setKat] = useState(review ? initial.kat : "Üniversite Takviye");
  const [konu, setKonu] = useState(initial.konu);
  const [dil, setDil] = useState<"tr" | "en">(review?.locale === "en" ? "en" : "tr");
  const [gun, setGun] = useState(initialDay);
  const [metin, setMetin] = useState(review?.quote ?? "");
  const [ana, setAna] = useState(review ? isOnHome(review) : false);
  const [errors, setErrors] = useState({ ad: false, metin: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const kategoriler = kat && !DG_KATEGORILER.includes(kat) ? [...DG_KATEGORILER, kat].sort(compareTr) : DG_KATEGORILER;

  async function save() {
    const name = ad.trim();
    const quote = metin.trim();
    const next = { ad: !locked && !name, metin: !locked && !quote };
    setErrors(next);
    if (next.ad || next.metin) return;

    const home = homeList(rows);
    const wasHome = review ? isOnHome(review) : false;
    if (ana && !wasHome && home.length >= DG_MAX) {
      toast.error("Ana sayfada en fazla 20 yorum olabilir; önce birini kaldırın");
      return;
    }

    setSaving(true);
    let error: string | null = null;
    let target: TestimonialRow | null = review;
    const content = {
      name,
      quote,
      context: joinContext(kat, konu),
      locale: dil,
      ...(gun && gun !== initialDay ? { created_at: dayToIso(gun) } : {}),
    };

    if (review) {
      if (!locked) error = (await updateAdminTestimonial(review.id, content)).error;
    } else {
      const created = await createAdminTestimonial({ ...content, exam_code: null, active: true, verified: true, featured: false, display_order: 0 });
      error = created.error;
      target = created.data;
    }

    if (!error && target) {
      if (ana && !wasHome) error = await addReviewToHome(target, home);
      else if (!ana && wasHome) error = await removeReviewFromHome(target, home);
    }
    setSaving(false);
    if (error) {
      toast.error(error);
      if (target && !review) onSaved();
      return;
    }
    toast.success(review ? "Yorum güncellendi" : "Yorum eklendi");
    onSaved();
    dialogRef.current?.close();
  }

  const close = () => dialogRef.current?.close();

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog ref={dialogRef} className="fx-dlg" id="dg-dialog" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="dg-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="dg-title" className="m-htitle">{review ? "Yorumu Düzenle" : "Yeni Yorum"}</h2>
              <span className="m-hsub">{locked ? "Kaynaktan aktarılan yorumun yazarı, metni ve konusu değiştirilemez" : "Yorum web sitesinde yazarın kısaltılmış adıyla gösterilir"}</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" data-close="" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="m-body fx-body">
            <div className="fx-grid">
              <div className={`m-field${errors.ad ? " fx-err" : ""}`}>
                <label htmlFor="dg-ad" className="m-lab">Yazan <span className="m-req">*</span></label>
                <input id="dg-ad" className="m-input" placeholder="Örn. Ece A." value={ad} disabled={locked} onChange={(event) => { setAd(event.target.value); setErrors((e) => ({ ...e, ad: false })); }} />
              </div>
              <div className="m-field">
                <label htmlFor="dg-kat-i" className="m-lab">Kategori</label>
                <select id="dg-kat-i" className="m-input" value={kat} disabled={locked} onChange={(event) => setKat(event.target.value)}>
                  {!kat ? <option value="">Kategori yok</option> : null}
                  {kategoriler.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="m-field">
                <label htmlFor="dg-konu" className="m-lab">Ders / konu</label>
                <input id="dg-konu" className="m-input" placeholder="Örn. Fizik, YKS, IB Physics" value={konu} disabled={locked} onChange={(event) => setKonu(event.target.value)} />
              </div>
              <div className="m-field">
                <span className="m-lab" id="dg-dil-l">Dil</span>
                <div className="m-dur" role="radiogroup" aria-labelledby="dg-dil-l">
                  <label><input type="radio" name="dg-dil" value="TR" checked={dil === "tr"} disabled={locked} onChange={() => setDil("tr")} /><span>Türkçe</span></label>
                  <label><input type="radio" name="dg-dil" value="EN" checked={dil === "en"} disabled={locked} onChange={() => setDil("en")} /><span>İngilizce</span></label>
                </div>
              </div>
              <div className="m-field">
                <span className="m-lab" id="dg-tarih-l">Tarih</span>
                {locked ? (
                  <input id="dg-tarih" className="m-input" value={gun.split("-").reverse().join(".")} disabled aria-labelledby="dg-tarih-l" readOnly />
                ) : (
                  <RefDatePicker id="dg-tarih" value={gun} onChange={setGun} emptyLabel="Bugün" ariaLabel="Tarih" />
                )}
              </div>
            </div>
            <div className={`m-field${errors.metin ? " fx-err" : ""}`}>
              <div className="be-row" style={{ margin: 0 }}>
                <label htmlFor="dg-metin" className="m-lab">Yorum <span className="m-req">*</span></label>
                <span className="be-count" data-dg-count="">{metin.length} karakter</span>
              </div>
              <textarea id="dg-metin" className="m-textarea" rows={6} placeholder="Yorumun tam metni…" value={metin} disabled={locked} onChange={(event) => { setMetin(event.target.value); setErrors((e) => ({ ...e, metin: false })); }} />
            </div>
            <div className="fx-toggles">
              <div className="fx-toggle">
                <span className="fx-tl"><span id="dg-ana-l">Ana sayfada göster</span><small>En fazla 20 yorum ana sayfada gösterilir.</small></span>
                <button type="button" className="m-sw" role="switch" aria-checked={ana} aria-labelledby="dg-ana-l" id="dg-ana" data-fx-switch="" onClick={() => setAna((value) => !value)}><span className="m-knob" /></button>
              </div>
            </div>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" data-close="" onClick={close}>Vazgeç</button>
            <button type="button" className="m-save" data-dg-save="" disabled={saving} onClick={() => void save()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <span data-dg-save-t="">{saving ? "Kaydediliyor…" : review ? "Kaydet" : "Yorumu Ekle"}</span>
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
