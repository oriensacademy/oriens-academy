"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, X, AlertCircle, UserCheck } from "lucide-react";
import { Wave } from "@/components/ui/wave";
import {
  createManualAdminBooking,
  type BookingStatus,
} from "@/lib/admin/bookings";
import { listAdminStudents, type StudentProfile } from "@/lib/admin/students";

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialEmail?: string;
  initialName?: string;
  initialPhone?: string;
  initialStudentUserId?: string | null;
}

export function CreateBookingModal({
  isOpen,
  onClose,
  onCreated,
  initialEmail = "",
  initialName = "",
  initialPhone = "",
  initialStudentUserId = null,
}: CreateBookingModalProps) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [eventType, setEventType] = useState<"lesson" | "discovery" | "consultation" | "other">("lesson");
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [studentUserId, setStudentUserId] = useState<string | null>(initialStudentUserId);

  const [exam, setExam] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("14:00");
  const [liveMeetingUrl, setLiveMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<BookingStatus>("confirmed");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    exam?: string;
    subject?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    privacyConsent?: string;
  }>({});

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    listAdminStudents().then((res) => {
      if (!active) return;
      const list = res.data || [];
      setStudents(list);

      // Auto-bind student if initial student ID or email is provided
      if (initialStudentUserId || initialEmail) {
        const found = list.find(
          (s) => (initialStudentUserId && (s.userId === initialStudentUserId || s.id === initialStudentUserId)) ||
                 (initialEmail && s.email.toLowerCase() === initialEmail.toLowerCase())
        );
        if (found) {
          setSelectedStudentId(found.id);
          setFullName(found.fullName || initialName);
          setEmail(found.email || initialEmail);
          setPhone(found.phone || initialPhone);
          setStudentUserId(found.userId || initialStudentUserId);
          if (found.targetExam) setExam(found.targetExam);
          setPrivacyConsent(true);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, initialStudentUserId, initialEmail, initialName, initialPhone]);

  const handleStudentSelect = (val: string) => {
    setSelectedStudentId(val);
    if (!val) {
      setFullName(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
      setStudentUserId(initialStudentUserId);
      setPrivacyConsent(false);
      return;
    }

    const student = students.find((s) => s.id === val || s.userId === val);
    if (student) {
      setFullName(student.fullName || "");
      setEmail(student.email || "");
      setPhone(student.phone || "");
      setStudentUserId(student.userId || null);
      if (student.targetExam) setExam(student.targetExam);
      setPrivacyConsent(true);
    }
  };

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    const newErrors: typeof errors = {};
    if (!fullName.trim()) newErrors.fullName = "Ad Soyad alanı gereklidir.";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) newErrors.email = "Geçerli bir e-posta adresi giriniz.";
    if (!phone.trim()) newErrors.phone = "Telefon numarası gereklidir.";
    if (!exam.trim()) newErrors.exam = "Sınav veya alan bilgisi gereklidir.";
    if (!subject.trim()) newErrors.subject = "Ders veya konu başlığı gereklidir.";
    if (!date) newErrors.date = "Tarih seçilmelidir.";
    if (!startTime) newErrors.startTime = "Başlangıç saati gereklidir.";
    if (!endTime) newErrors.endTime = "Bitiş saati gereklidir.";
    if (!selectedStudentId && !studentUserId && !privacyConsent) {
      newErrors.privacyConsent = "Gizlilik onayını doğrulamanız gerekmektedir.";
    }

    if (liveMeetingUrl.trim() && !/^https?:\/\/.+/i.test(liveMeetingUrl.trim())) {
      setErrorMsg("Canlı ders bağlantısı geçerli bir https:// URL adresi olmalıdır.");
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    const eventPrefix =
      eventType === "lesson"
        ? "[Ders]"
        : eventType === "discovery"
        ? "[Ön Görüşme]"
        : eventType === "consultation"
        ? "[Danışmanlık]"
        : "[Görüşme]";

    const combinedSubject = subject.startsWith("[") ? subject : `${eventPrefix} ${subject.trim()}`;

    const { error } = await createManualAdminBooking({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      exam: exam.trim(),
      subject: combinedSubject,
      startsAt: new Date(`${date}T${startTime}:00`).toISOString(),
      endsAt: new Date(`${date}T${endTime}:00`).toISOString(),
      notes: notes.trim(),
      status,
      privacyConsent: Boolean(privacyConsent || studentUserId),
      studentUserId,
      liveMeetingUrl: liveMeetingUrl.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      setErrorMsg(error);
      return;
    }
    onCreated();
    onClose();
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-lg border bg-white px-3 py-2 text-xs text-foreground outline-hidden transition-colors ${
      hasError
        ? "border-red-400 bg-red-50/20 focus:border-red-500"
        : "border-input focus:border-[#10271B]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <CalendarPlus className="size-5 text-[#819586]" />
            <h2 className="text-base font-bold text-ink">Randevu & Ders Planla</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <form noValidate onSubmit={submit} className="space-y-3.5">
          {/* Event Type Selector */}
          <div>
            <span className="block text-xs font-semibold text-muted-foreground mb-1.5">Etkinlik Türü</span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "lesson", label: "Ders" },
                { id: "discovery", label: "Ön Görüşme" },
                { id: "consultation", label: "Danışmanlık" },
                { id: "other", label: "Diğer" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEventType(t.id as typeof eventType)}
                  className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    eventType === t.id
                      ? "border-[#10271B] bg-[#10271B] text-white"
                      : "border-border bg-surface-muted text-muted-foreground hover:bg-white hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Existing Student Dropdown */}
          <div className="rounded-xl border border-primary/20 bg-forest/5 p-3">
            <label className="block space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <UserCheck className="size-3.5 text-primary" />
                Kayıtlı Öğrenci Seç (Otomatik Bağlama)
              </span>
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className={inputClass()}
              >
                <option value="">-- Yeni / Manuel Öğrenci (Seçim Yok) --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} — {s.email} {s.targetExam ? `(${s.targetExam})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Öğrenci seçildiğinde ad, e-posta ve telefon bilgileri otomatik doldurulur ve randevu doğrudan öğrenci portalına bağlanır.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ad Soyad" error={errors.fullName}>
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors({ ...errors, fullName: undefined });
                }}
                placeholder="Öğrenci Adı Soyadı"
                className={inputClass(Boolean(errors.fullName))}
              />
            </Field>
            <Field label="E-posta" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                placeholder="ornek@ogrenci.com"
                className={inputClass(Boolean(errors.email))}
              />
            </Field>
            <Field label="Telefon" error={errors.phone}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                placeholder="+90 5XX XXX XX XX"
                className={inputClass(Boolean(errors.phone))}
              />
            </Field>
            <Field label="Sınav / Alan" error={errors.exam}>
              <input
                value={exam}
                onChange={(e) => {
                  setExam(e.target.value);
                  if (errors.exam) setErrors({ ...errors, exam: undefined });
                }}
                placeholder="SAT, IB, AP, Danışmanlık vb."
                className={inputClass(Boolean(errors.exam))}
              />
            </Field>
            <Field label="Ders / Konu Başlığı" error={errors.subject}>
              <input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (errors.subject) setErrors({ ...errors, subject: undefined });
                }}
                placeholder="Örn: Birebir Matematik Görüşmesi"
                className={inputClass(Boolean(errors.subject))}
              />
            </Field>
            <Field label="Durum">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                className={inputClass()}
              >
                <option value="confirmed">Onaylandı</option>
                <option value="pending">Bekliyor</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal</option>
                <option value="no_show">Gelmedi</option>
              </select>
            </Field>
            <Field label="Tarih" error={errors.date}>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) setErrors({ ...errors, date: undefined });
                }}
                className={inputClass(Boolean(errors.date))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Başlangıç" error={errors.startTime}>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    if (errors.startTime) setErrors({ ...errors, startTime: undefined });
                  }}
                  className={inputClass(Boolean(errors.startTime))}
                />
              </Field>
              <Field label="Bitiş" error={errors.endTime}>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    if (errors.endTime) setErrors({ ...errors, endTime: undefined });
                  }}
                  className={inputClass(Boolean(errors.endTime))}
                />
              </Field>
            </div>
          </div>

          {/* Optional Live Meeting Link */}
          <Field label="Canlı Ders / Görüşme Bağlantısı (İsteğe Bağlı)">
            <div className="relative">
              <input
                type="url"
                value={liveMeetingUrl}
                onChange={(e) => setLiveMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
                className={inputClass()}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              Bağlantı girilirse onay e-postasında ve öğrenci panelinde &ldquo;Görüşmeye Katıl&rdquo; butonu olarak sunulur.
            </span>
          </Field>

          <Field label="Yönetici Notu (İsteğe Bağlı)">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Randevu ile ilgili özel notlar..."
              className={inputClass()}
            />
          </Field>

          {!selectedStudentId && (
            <div className="space-y-1">
              <label className="flex items-start gap-2 rounded-lg border border-border bg-background-soft/50 p-2.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => {
                    setPrivacyConsent(e.target.checked);
                    if (errors.privacyConsent) setErrors({ ...errors, privacyConsent: undefined });
                  }}
                  className="mt-0.5"
                />
                <span>Kişinin verilerinin bu randevu için işlenmesine ilişkin gizlilik onayının alındığını doğruluyorum.</span>
              </label>
              {errors.privacyConsent && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.privacyConsent}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input px-4 py-2 text-xs font-medium hover:bg-surface-muted cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-forest cursor-pointer"
            >
              {submitting ? (
                <>
                  <Wave className="h-4 w-8 text-amber-400" />
                  <span>Oluşturuluyor…</span>
                </>
              ) : (
                "Randevuyu Oluştur"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {error && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </span>
      )}
    </label>
  );
}
