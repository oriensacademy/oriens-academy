"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RefDatePicker, RefTimeSelect } from "@/components/admin/RefDatePicker";
import { packageDisplayName } from "@/lib/packages/display";
import { LESSON_TIMEZONES, type LessonTimezoneLabel } from "@/lib/lessons/timezones";
import type { InstructorReference, LessonReference, PackageOption, PackagePurchase } from "@/lib/admin/student-learning";
import { formatTrLira } from "@/lib/format/turkish";
import pages from "./admin-pages.module.css";

// Öğrenci detayındaki referans pencereleri (oriens-admin_6.html):
//  - #ders-dialog       "Ders Kaydı Ekle"
//  - #ders-edit-dialog  "Dersi Düzenle"
//  - #hak-dialog        "Ders Hakkı Ekle"
// Bu bileşenler yalnızca görünümü üstlenir; kayıt, ders hakkı ve e-posta
// işlemleri StudentLearningManager'daki mevcut sunucu çağrılarıyla yapılır.

export type RefLessonForm = {
  topicId: string;
  subject: string;
  instructorId: string;
  date: string;
  startTime: string;
  timezoneLabel: LessonTimezoneLabel;
  durationMinutes: number;
  packagePurchaseId: string;
  completionReport: string;
  sendEmail: boolean;
};

const DURATIONS = [60, 90, 120];

function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return ref;
}

export const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;
const InfoIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A57622" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
export const GearIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

function SecHead({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="m-sechead">
      <span className="m-secbadge">{icon}</span>
      <h3 className="m-sectitle">{title}</h3>
      <span className="m-secline" />
    </div>
  );
}

const BookIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z" /></svg>;
const ClockIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4M8 2v4M3 10h5" /><circle cx="17.5" cy="17.5" r="4.5" /><path d="M17.5 15.5v2l1.5 1" /></svg>;
const ClipIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2h6v4H9z" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h4" /></svg>;

function Switch({ id, label, hint, checked, onChange }: { id: string; label: string; hint: ReactNode; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="m-toggle">
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span id={id} style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#5B635C" }}>{hint}</span>
      </div>
      <button type="button" className="m-sw" role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)}><span className="m-knob" /></button>
    </div>
  );
}

function remainingOf(purchase: PackagePurchase) {
  return (purchase.lesson_count || 0) - (purchase.lessons_used || 0);
}

function DialogError({ message }: { message: string }) {
  return message ? <p role="alert" className="m-warn" style={{ margin: "12px 0 0" }}>{message}</p> : null;
}

export function RefLessonDialog({
  mode,
  studentName,
  notifyEmail,
  form,
  onChange,
  topics,
  instructors,
  purchases,
  lastSentAt,
  customTitle,
  busy,
  error,
  onClose,
  onSubmit,
  onManage,
  onAddPackage,
  children,
}: {
  mode: "create" | "edit";
  studentName: string;
  notifyEmail: string;
  form: RefLessonForm;
  onChange: (patch: Partial<RefLessonForm>) => void;
  topics: LessonReference[];
  instructors: InstructorReference[];
  purchases: PackagePurchase[];
  lastSentAt?: string | null;
  customTitle?: string | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onManage: (kind: "topic" | "instructor") => void;
  onAddPackage?: () => void;
  children?: ReactNode;
}) {
  const ref = useModal();
  const edit = mode === "edit";
  const p = edit ? "e" : "d";
  const [hour, minute] = (form.startTime || "00:00").split(":");
  // Eski kayıtlarda listede olmayan bir süre (ör. 45 dk) varsa seçenek olarak korunur.
  const legacyDuration = Number.isInteger(form.durationMinutes) && form.durationMinutes > 0 && !DURATIONS.includes(form.durationMinutes);
  const durations = legacyDuration ? [...DURATIONS, form.durationMinutes].sort((a, b) => a - b) : DURATIONS;
  const close = () => { if (!busy) onClose(); };
  // Yeni kayıtta paket alanı ilk uygun paketle dolu açılır; paketler pencere
  // açıldıktan sonra yüklenirse ilk paket o anda seçilir. Düzenlemede mevcut
  // paket aynen korunur (otomatik seçim ders hakkı aktarımı demektir).
  const firstPurchaseId = purchases[0]?.id || "";
  useEffect(() => {
    if (!edit && !form.packagePurchaseId && firstPurchaseId) onChange({ packagePurchaseId: firstPurchaseId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit, firstPurchaseId, form.packagePurchaseId]);
  const lastSent = lastSentAt ? new Date(lastSentAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={ref}
        className="ders"
        id={edit ? "ders-edit-dialog" : "ders-dialog"}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <form className="m-modal" role="dialog" aria-modal="true" aria-labelledby={`${p}-ders-title`} onSubmit={onSubmit}>
          <div className="m-head">
            <div className="m-hicon">
              {edit
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10271B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10271B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id={`${p}-ders-title`} className="m-htitle">{edit ? "Dersi Düzenle" : "Ders Kaydı Ekle"}</h2>
              <span className="m-hsub">{studentName}</span>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" onClick={close}><CloseIcon /></button>
          </div>
          <div className="m-body">
            <div className="m-info" style={{ marginTop: 16 }}>
              <InfoIcon />
              {edit
                ? <span>Paketi değiştirirseniz ders hakkı <b>eski paketten yeni pakete aktarılır</b>. Diğer değişiklikler ders hakkını etkilemez.</span>
                : <span>Tamamlanmış bir dersin kaydı oluşturulur ve seçilen paketten <b>1 ders hakkı düşülür</b>.</span>}
            </div>
            <DialogError message={error} />
            <section className="m-sec">
              <SecHead title="Ders" icon={BookIcon} />
              <div className="m-grid">
                <div className="m-field">
                  <label htmlFor={`${p}-ders`} className="m-lab">Ders <span className="m-req">*</span></label>
                  <div className="m-row">
                    <select id={`${p}-ders`} className="m-input" value={form.topicId} onChange={(event) => onChange({ topicId: event.target.value })}>
                      <option value="">{customTitle || "Ders seçin"}</option>
                      {topics.filter((item) => item.active || item.id === form.topicId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <button type="button" className="m-gear" aria-label="Ders listesini yönet" onClick={() => onManage("topic")}><GearIcon /></button>
                  </div>
                </div>
                <div className="m-field">
                  <label htmlFor={`${p}-egitmen`} className="m-lab">Eğitmen <span className="m-req">*</span></label>
                  <div className="m-row">
                    <select id={`${p}-egitmen`} className="m-input" value={form.instructorId} onChange={(event) => onChange({ instructorId: event.target.value })}>
                      <option value="">Eğitmen seçin</option>
                      {instructors.filter((item) => item.active || item.id === form.instructorId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <button type="button" className="m-gear" aria-label="Eğitmen listesini yönet" onClick={() => onManage("instructor")}><GearIcon /></button>
                  </div>
                </div>
              </div>
              <div className="m-field">
                <label htmlFor={`${p}-konu`} className="m-lab">Konu / Alan</label>
                <input id={`${p}-konu`} type="text" className="m-input" placeholder="Örn. Integration by Parts" maxLength={160} value={form.subject} onChange={(event) => onChange({ subject: event.target.value })} />
              </div>
            </section>
            <section className="m-sec">
              <SecHead title="Zaman" icon={ClockIcon} />
              <div className="m-grid4">
                <div className="m-field">
                  <label htmlFor={`${p}-tarih`} className="m-lab">Tarih</label>
                  <RefDatePicker id={`${p}-tarih`} value={form.date} onChange={(date) => onChange({ date })} emptyLabel="Tarih seçin" ariaLabel="Tarih seç" />
                </div>
                <div className="m-field">
                  <span className="m-lab">Başlangıç</span>
                  <RefTimeSelect hour={hour} minute={minute} onChange={(h, m) => onChange({ startTime: `${h}:${m}` })} />
                </div>
                <div className="m-field">
                  <span className="m-lab" id={`${p}-sure-lab`}>Süre</span>
                  <div className={`m-dur d${durations.length}`} role="radiogroup" aria-labelledby={`${p}-sure-lab`}>
                    {durations.map((value) => (
                      <label key={value}><input type="radio" name={`${p}-sure`} value={value} checked={form.durationMinutes === value} onChange={() => onChange({ durationMinutes: value })} /><span>{value} dk</span></label>
                    ))}
                  </div>
                </div>
                <div className="m-field">
                  <label htmlFor={`${p}-tz`} className="m-lab">Saat Dilimi</label>
                  <select id={`${p}-tz`} className="m-input" value={form.timezoneLabel} onChange={(event) => onChange({ timezoneLabel: event.target.value as LessonTimezoneLabel })}>
                    {LESSON_TIMEZONES.map((zone) => <option key={zone.label} value={zone.label}>{zone.label}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section className="m-sec">
              <SecHead title="Paket ve Rapor" icon={ClipIcon} />
              {purchases.length === 0 ? (
                <div className="m-warn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A3324" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
                  <div>
                    <b>Bu öğrencinin aktif paketi yok.</b> Ders kaydı eklemek için önce bir paket tanımlayın.
                    {onAddPackage ? (
                      <div style={{ marginTop: 10 }}>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => { onClose(); onAddPackage(); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>
                          Yeni Paket Tanımla
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="m-field">
                  <label htmlFor={`${p}-paket`} className="m-lab">{edit ? "Ders hakkının düştüğü paket" : "Ders hakkının düşüleceği paket"} <span className="m-req">*</span></label>
                  <select id={`${p}-paket`} className="m-input" value={form.packagePurchaseId} onChange={(event) => onChange({ packagePurchaseId: event.target.value })}>
                    {!form.packagePurchaseId ? <option value="">Paket seçin</option> : null}
                    {purchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{packageDisplayName(purchase)} ({remainingOf(purchase)} ders kaldı)</option>)}
                  </select>
                </div>
              )}
              <div className="m-field">
                <label htmlFor={`${p}-rapor`} className="m-lab">Ders sonu raporu{edit ? null : <> <span className="m-opt">(isteğe bağlı)</span></>}</label>
                <textarea id={`${p}-rapor`} rows={4} className="m-textarea" maxLength={10000} placeholder={edit ? undefined : "İşlenen konular, öğrencinin gelişimi ve sonraki çalışma önerileri…"} value={form.completionReport} onChange={(event) => onChange({ completionReport: event.target.value })} />
                {edit ? (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#5B635C" }}>
                    <span>{lastSent ? `Son gönderim: ${lastSent}` : "Henüz gönderilmedi"}</span>
                    <span>{form.completionReport.length} / 10000</span>
                  </div>
                ) : null}
              </div>
              {edit
                ? <Switch id="e-mail-l" label="Güncellenmiş raporu tekrar gönder" hint={<>Açıksa kaydettiğinizde rapor veliye yeniden gönderilir ({notifyEmail || "kayıtlı e-posta adresi"}).</>} checked={form.sendEmail} onChange={(sendEmail) => onChange({ sendEmail })} />
                : <Switch id="d-mail-l" label="E-posta ile bildir" hint={<>Kayıt bilgisi veliye e-postayla gönderilir ({notifyEmail || "kayıtlı e-posta adresi"}).</>} checked={form.sendEmail} onChange={(sendEmail) => onChange({ sendEmail })} />}
            </section>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" onClick={close} disabled={busy}>Vazgeç</button>
            <button type="submit" className="m-save" disabled={busy || (!edit && purchases.length === 0)} aria-busy={busy}>
              {edit ? null : <CheckIcon />}
              {busy ? "Kaydediliyor…" : edit ? "Kaydet" : "Dersi Kaydet"}
            </button>
          </div>
        </form>
        {children}
      </dialog>
    </div>
  );
}

const HAK_CHIPS = [1, 2, 3, 5, 10];

export function RefHakDialog({
  purchase,
  notifyEmail,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  purchase: PackagePurchase;
  notifyEmail: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (request: { amount: number; note: string; sendNotification: boolean }) => void;
}) {
  const ref = useModal();
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState("");
  const [sendNotification, setSendNotification] = useState(false);
  const total = purchase.lesson_count || 0;
  const used = purchase.lessons_used || 0;
  const remaining = total - used;
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= 100;
  const close = () => { if (!busy) onClose(); };
  const setClamped = (value: number) => setAmount(Math.min(100, Math.max(1, Math.round(value) || 1)));

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={ref}
        className="hak"
        id="hak-dialog"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="hak-title">
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10271B" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <h2 id="hak-title" className="m-htitle">Ders Hakkı Ekle</h2>
            </div>
            <button type="button" className="m-close" aria-label="Kapat" onClick={close}><CloseIcon /></button>
          </div>
          <div className="m-body">
            <div className="m-pkg">
              <span className="m-pkgname">{packageDisplayName(purchase)}</span>
              <span className="m-pkgmeta">{total} toplam · {used} kullanılan · <b style={{ color: "#10271B" }}>{remaining} kalan</b></span>
            </div>
            <DialogError message={error} />
            <section className="m-sec">
              <div className="m-field">
                <label htmlFor="hak-amt" className="m-lab">Eklenecek ders</label>
                <div className="m-amtrow">
                  <div className="m-stepper">
                    <button type="button" className="m-stepbtn" aria-label="Azalt" disabled={amount <= 1} onClick={() => setClamped(amount - 1)}>−</button>
                    <input id="hak-amt" type="number" min={1} max={100} className="m-stepin" value={amount} onChange={(event) => setClamped(Number(event.target.value))} />
                    <button type="button" className="m-stepbtn" aria-label="Artır" disabled={amount >= 100} onClick={() => setClamped(amount + 1)}>+</button>
                  </div>
                  <div className="m-chips">
                    {HAK_CHIPS.map((chip) => (
                      <button key={chip} type="button" className={amount === chip ? "m-qchipon" : "m-qchip"} aria-pressed={amount === chip} onClick={() => setAmount(chip)}>+{chip}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="m-sum" aria-live="polite">
                <div className="m-sumbox"><span className="m-sumlab">Toplam</span><span className="m-sumval"><span className="m-old">{total}</span><span className="m-new">{total + amount}</span></span></div>
                <div className="m-sumbox"><span className="m-sumlab">Kullanılan</span><span className="m-sumval"><span className="m-new" style={{ marginLeft: 0 }}>{used}</span> sabit</span></div>
                <div className="m-sumboxhi"><span className="m-sumlabhi">Yeni Kalan</span><span className="m-sumvalhi"><span className="m-old">{remaining}</span><span className="m-newhi">{remaining + amount}</span></span></div>
              </div>
            </section>
            <section className="m-sec" style={{ paddingTop: 0 }}>
              <div className="m-field">
                <label htmlFor="hak-not" className="m-lab">Açıklama <span className="m-opt">(isteğe bağlı)</span></label>
                <textarea id="hak-not" rows={3} className="m-textarea" style={{ minHeight: 84 }} maxLength={1000} placeholder="Örn. Telafi dersi" value={note} onChange={(event) => setNote(event.target.value)} />
              </div>
              <Switch id="hak-mail-l" label="Ders hakkı güncelleme e-postası gönder" hint={<>Veliye gönderilir ({notifyEmail || "kayıtlı e-posta adresi"}). E-postada yalnızca toplam kalan ders hakkı yazar.</>} checked={sendNotification} onChange={setSendNotification} />
            </section>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" onClick={close} disabled={busy}>İptal</button>
            <button type="button" className="m-save" disabled={busy || !valid} aria-busy={busy} onClick={() => onSubmit({ amount, note, sendNotification })}>
              <PlusIcon /><span>{busy ? "Kaydediliyor…" : `${amount} Ders Hakkı Ekle`}</span>
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

export type RefListItem = { id: string; label: string; active: boolean };

// Referans liste yöneticileri (#sinif-dialog, #sinav-dialog, #derslist-dialog,
// #egitmen-dialog). Ekleme/yeniden adlandırma/aktiflik işlemleri çağıran
// bileşenin mevcut sunucu çağrısıyla (onAction) yapılır.
export function RefListManagerDialog({
  id,
  title,
  subtitle,
  inputLabel,
  placeholder,
  renamePlaceholder,
  countUnit,
  maxLength,
  items,
  onAction,
  onClose,
}: {
  id: string;
  title: string;
  subtitle: string;
  inputLabel: string;
  placeholder: string;
  renamePlaceholder: string;
  countUnit: string;
  maxLength: number;
  items: RefListItem[];
  onAction: (action: "create" | "rename" | "activate" | "deactivate", label: string, item?: RefListItem) => Promise<string | null>;
  onClose: () => void;
}) {
  const ref = useModal();
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label, "tr-TR", { numeric: true }));

  async function run(action: "create" | "rename" | "activate" | "deactivate", item?: RefListItem) {
    if (busy) return;
    setBusy(true);
    setError("");
    const failure = await onAction(action, draft, item);
    setBusy(false);
    if (failure) { setError(failure); return; }
    if (action === "create" || action === "rename") { setDraft(""); setEditId(null); }
  }
  const submit = () => { if (draft.trim()) void run(editId ? "rename" : "create", items.find((item) => item.id === editId)); };

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={ref}
        className="sinif"
        id={`${id}-dialog`}
        onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
        onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="s-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
          <div className="s-head">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h2 id={`${id}-title`} className="s-title">{title}</h2>
              <span className="s-sub">{subtitle}</span>
            </div>
            <button type="button" className="s-close" aria-label="Kapat" onClick={onClose}><CloseIcon /></button>
          </div>
          <div className="s-addrow">
            <label htmlFor={`yeni-${id}`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{inputLabel}</label>
            <input
              id={`yeni-${id}`}
              className="s-input"
              placeholder={editId ? renamePlaceholder : placeholder}
              maxLength={maxLength}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); submit(); }
                if (event.key === "Escape" && editId) { event.preventDefault(); event.stopPropagation(); setEditId(null); setDraft(""); }
              }}
            />
            <button type="button" className="s-add" disabled={busy || !draft.trim()} onClick={submit}>
              {editId ? <CheckIcon /> : <PlusIcon />}{editId ? "Kaydet" : "Ekle"}
            </button>
          </div>
          {error ? <p role="alert" className="m-warn" style={{ margin: "0 24px 8px" }}>{error}</p> : null}
          <div className="s-meta"><span>Alfabetik sıralı</span><span>{items.length} {countUnit}</span></div>
          <ul className="s-list">
            {sorted.map((item) => (
              <li key={item.id} className={item.active ? "s-item" : "s-item off"}>
                <span className="s-name">{item.label}</span>
                <button type="button" className="s-ib" aria-label={`${item.label} düzenle`} disabled={busy} onClick={() => { setEditId(item.id); setDraft(item.label); setError(""); }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button type="button" className="s-sw" role="switch" aria-checked={item.active} aria-label={`${item.label} aktif`} disabled={busy} onClick={() => void run(item.active ? "deactivate" : "activate", item)}><span className="s-knob" /></button>
              </li>
            ))}
          </ul>
          <div className="s-foot">
            <span className="s-hint">Liste otomatik olarak alfabetik sıralanır.</span>
            <button type="button" className="s-done" onClick={onClose}>Kapat</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

// admin_adjust_package_lessons 3–200 karakterlik neden ister. Referans
// penceresinde Açıklama isteğe bağlı; boşsa sabit neden gönderilir, uzun
// açıklamanın tamamı ayrıca not alanında (≤1000) saklanır.
export const LESSON_RIGHTS_DEFAULT_REASON = "Panelden ders hakkı eklendi";

export function lessonRightsReasonFromNote(note: string): { reason: string; notes: string | null } {
  const clean = note.trim().replace(/\s+/g, " ");
  if (!clean) return { reason: LESSON_RIGHTS_DEFAULT_REASON, notes: null };
  const reason = clean.length >= 3 ? clean.slice(0, 200) : `${LESSON_RIGHTS_DEFAULT_REASON}: ${clean}`;
  return { reason, notes: clean.length > 200 ? note.trim().slice(0, 1000) : null };
}

export type RefPkForm = {
  packageId: string;
  paymentStatus: "pending" | "paid" | "waived";
  startDate: string;
  adminNotes: string;
  sendNotification: boolean;
};

// Referans "Yeni Paket Tanımla" (#pk-dialog): hazır paket kartları, ödeme
// durumu (Banka Transferi / Ücretsiz tanımlandı), banka transferinde ödeme
// tarihi, isteğe bağlı yönetici notu ve bilgilendirme e-postası anahtarı.
export function RefPkDialog({
  packages,
  form,
  onChoosePackage,
  onChange,
  notifyEmail,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  packages: PackageOption[];
  form: RefPkForm;
  onChoosePackage: (id: string) => void;
  onChange: (patch: Partial<RefPkForm>) => void;
  notifyEmail: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const ref = useModal();
  const close = () => { if (!busy) onClose(); };
  const pays = [{ value: "paid", label: "Banka Transferi" }, { value: "waived", label: "Ücretsiz tanımlandı" }] as const;

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={ref}
        className="pk"
        id="pk-dialog"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <form className="m-modal" role="dialog" aria-modal="true" aria-labelledby="pk-title" onSubmit={onSubmit}>
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10271B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><h2 id="pk-title" className="m-htitle">Yeni Paket Tanımla</h2></div>
            <button type="button" className="m-close" aria-label="Kapat" onClick={close}><CloseIcon /></button>
          </div>
          <div className="m-body">
            <DialogError message={error} />
            <section className="m-sec" style={{ gap: 18, paddingTop: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="m-lab">Paket seçin <span className="m-req">*</span></span>
                <div className="m-cards" role="radiogroup" aria-label="Hazır paketler">
                  {packages.map((item) => {
                    const count = item.lesson_count || 0;
                    return (
                      <label key={item.id} className={form.packageId === item.id ? "m-cardon" : "m-card"}>
                        <input type="radio" name="pk" value={item.id} className="m-radio" checked={form.packageId === item.id} onChange={() => onChoosePackage(item.id)} />
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <span className="m-cnum">{count}</span>
                          <span className="m-cunit">{count === 1 ? "ders" : "derslik"}</span>
                        </span>
                        <span className="m-cprice">{formatTrLira(Number(item.current_total ?? item.price_amount ?? 0))}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="m-field">
                <span className="m-lab">Ödeme durumu</span>
                <div className="m-pills" role="radiogroup" aria-label="Ödeme durumu">
                  {pays.map((item) => (
                    <label key={item.value} className={form.paymentStatus === item.value ? "m-pillon" : "m-pill"}>
                      <input type="radio" name="pay" value={item.value} className="m-radio" checked={form.paymentStatus === item.value} onChange={() => onChange({ paymentStatus: item.value })} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              {form.paymentStatus === "paid" ? (
                <div className="m-grid">
                  <div className="m-field">
                    <label htmlFor="pk-tarih" className="m-lab">Ödeme tarihi <span className="m-req">*</span></label>
                    <RefDatePicker id="pk-tarih" value={form.startDate} onChange={(startDate) => onChange({ startDate })} emptyLabel="Tarih seçin" ariaLabel="Tarih seç" />
                  </div>
                </div>
              ) : null}
              <div className="m-field">
                <label htmlFor="pk-not" className="m-lab">Yönetici notu <span className="m-opt">(isteğe bağlı)</span></label>
                <input id="pk-not" className="m-input" placeholder="İç referans veya açıklama notu" maxLength={500} value={form.adminNotes} onChange={(event) => onChange({ adminNotes: event.target.value })} />
              </div>
              <Switch id="pk-mail-l" label="Paket bilgilendirme e-postası gönder" hint={<>Açıksa paket bilgisi veliye gönderilir ({notifyEmail || "kayıtlı e-posta adresi"}).</>} checked={form.sendNotification} onChange={(sendNotification) => onChange({ sendNotification })} />
            </section>
          </div>
          <div className="m-foot">
            <button type="button" className="m-cancel" onClick={close} disabled={busy}>İptal</button>
            <button type="submit" className="m-save" disabled={busy || !form.packageId || (form.paymentStatus === "paid" && !form.startDate)} aria-busy={busy}>
              <CheckIcon />{busy ? "Kaydediliyor…" : "Paketi Tanımla"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
