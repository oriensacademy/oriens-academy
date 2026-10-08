"use client";

import { useEffect, useRef, useState } from "react";
import { adminCreateStudent, listStudentGradeOptions, type StudentGradeOption } from "@/lib/admin/students";
import { normalizeStudentPhone } from "@/lib/format/phone";
import { AdminTrPhoneInput } from "@/components/admin/AdminTrPhoneInput";
import pages from "./admin-pages.module.css";

// Referans "Yeni Öğrenci" (#yo-dialog). Kayıt tek RPC ile açılır
// (admin_create_student): auth kullanıcısı, veli hesabı, paket, ödeme veya
// e-posta oluşturulmaz. Pencere açıkken üretilen istek anahtarı çift tıklama
// ve ağ tekrarlarında ikinci kaydı engeller.
//
// Referanstaki "İlk paket (isteğe bağlı)" bölümü burada yok: panelde paket
// tanımlamanın kanonik bir sunucu akışı bulunmuyor ve ödeme / paket hakkı
// mantığına dokunulmuyor. Paket, öğrencinin satın alma akışından gelir.

type Form = { ad: string; okul: string; sinif: string; program: string; veli: string; tel: string; eposta: string };
const EMPTY_FORM: Form = { ad: "", okul: "", sinif: "", program: "", veli: "", tel: "", eposta: "" };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}

export function NewStudentDialog({ programs, onClose, onCreated }: {
  programs: string[];
  onClose: () => void;
  onCreated: (student: { id: string; name: string }) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [requestId] = useState(newRequestId);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ ad?: boolean; tel?: boolean; eposta?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [grades, setGrades] = useState<StudentGradeOption[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    nameRef.current?.focus();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    let alive = true;
    void listStudentGradeOptions().then((result) => {
      if (alive) setGrades(result.data.filter((option) => option.active).sort((a, b) => a.sort_order - b.sort_order));
    });
    return () => { alive = false; };
  }, []);

  const set = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "ad" || key === "tel" || key === "eposta") setErrors((current) => (current[key] ? { ...current, [key]: false } : current));
    setServerError("");
  };

  async function save() {
    if (savingRef.current) return;
    const ad = form.ad.trim().replace(/\s+/g, " ");
    const eposta = form.eposta.trim();
    const phone = normalizeStudentPhone(form.tel);
    const next = { ad: !ad, tel: phone === undefined, eposta: Boolean(eposta) && !EMAIL_RE.test(eposta) };
    setErrors(next);
    if (next.ad || next.tel || next.eposta) return;
    savingRef.current = true;
    setSaving(true);
    const result = await adminCreateStudent({
      requestId,
      fullName: ad,
      school: form.okul,
      gradeLevel: form.sinif,
      educationProgram: form.program,
      guardianName: form.veli,
      phone: phone ?? "",
      email: eposta,
    });
    savingRef.current = false;
    setSaving(false);
    if (!result.success || !result.studentId) {
      setServerError(result.error || "Öğrenci oluşturulamadı.");
      return;
    }
    onCreated({ id: result.studentId, name: ad });
    dialogRef.current?.close();
  }

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog ref={dialogRef} className="fx-dlg" id="yo-dialog" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="yo-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><h2 id="yo-title" className="m-htitle">Yeni Öğrenci</h2><span className="m-hsub">Öğrenci ve veli iletişim bilgileri</span></div>
            <button type="button" className="m-close" aria-label="Kapat" data-close="" disabled={saving} onClick={() => dialogRef.current?.close()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="m-body fx-body">
            <section className="fx-sec"><h3 className="fx-sh">Öğrenci</h3>
              <div className="fx-grid">
                <div className={`m-field${errors.ad ? " fx-err" : ""}`}><label htmlFor="yo-ad" className="m-lab">Ad Soyad <span className="m-req">*</span></label><input ref={nameRef} id="yo-ad" className="m-input" autoComplete="off" placeholder="Örn. Deniz Yılmaz" maxLength={100} value={form.ad} onChange={(event) => set("ad", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="yo-okul" className="m-lab">Okul</label><input id="yo-okul" className="m-input" placeholder="Örn. Robert Kolej" maxLength={160} value={form.okul} onChange={(event) => set("okul", event.target.value)} /></div>
                <div className="m-field"><label htmlFor="yo-sinif" className="m-lab">Sınıf</label>
                  <select id="yo-sinif" className="m-input" value={form.sinif} onChange={(event) => set("sinif", event.target.value)}>
                    <option value="">Seçin</option>
                    {grades.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
                  </select>
                </div>
                <div className="m-field"><label htmlFor="yo-prog" className="m-lab">Eğitim programı</label><input id="yo-prog" className="m-input" list="yo-prog-l" placeholder="Örn. IB Diploma" maxLength={160} value={form.program} onChange={(event) => set("program", event.target.value)} /><datalist id="yo-prog-l">{programs.map((p) => <option key={p} value={p} />)}</datalist></div>
                <div className={`m-field${errors.tel ? " fx-err" : ""}`} style={{ gridColumn: "1/-1" }}><label htmlFor="yo-tel" className="m-lab">Telefon Numarası</label><AdminTrPhoneInput id="yo-tel" value={form.tel} invalid={errors.tel} describedBy={errors.tel ? "yo-tel-err" : undefined} onChange={(value) => set("tel", value)} />{errors.tel ? <small id="yo-tel-err" className="yo-hint" style={{ color: "#9A3324" }}>Geçerli bir telefon numarası girin.</small> : null}</div>
              </div>
            </section>
            <section className="fx-sec"><h3 className="fx-sh">Veli</h3>
              <div className="fx-grid">
                <div className="m-field"><label htmlFor="yo-veli" className="m-lab">Veli ad soyad</label><input id="yo-veli" className="m-input" placeholder="Boşsa iletişim öğrenciye ait sayılır" maxLength={100} value={form.veli} onChange={(event) => set("veli", event.target.value)} /></div>
                <div className={`m-field${errors.eposta ? " fx-err" : ""}`} style={{ gridColumn: "1/-1" }}><label htmlFor="yo-eposta" className="m-lab">E-posta</label><input id="yo-eposta" className="m-input" type="email" placeholder="ornek@mail.com" maxLength={254} value={form.eposta} onChange={(event) => set("eposta", event.target.value)} /><small className="yo-hint">Ders raporları ve bildirimler bu adrese gönderilir.</small></div>
              </div>
            </section>
            {serverError ? <p role="alert" className="m-hint" style={{ color: "#9A3324", margin: 0 }}>{serverError}</p> : null}
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" data-close="" disabled={saving} onClick={() => dialogRef.current?.close()}>Vazgeç</button>
            <button type="button" className="m-save" data-yo-save="" disabled={saving} aria-busy={saving} onClick={() => void save()}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{saving ? "Ekleniyor…" : "Öğrenciyi Ekle"}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
