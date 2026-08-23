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

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    listAdminStudents().then((res) => {
      if (!active) return;
      setStudents(res.data || []);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

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
      if (student.targetExam && !exam) setExam(student.targetExam);
      setPrivacyConsent(true); // Existing student already consented
    }
  };

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    if (liveMeetingUrl.trim() && !/^https?:\/\/.+/i.test(liveMeetingUrl.trim())) {
      setSubmitting(false);
      setErrorMsg("Canlı ders bağlantısı geçerli bir https:// URL adresi olmalıdır.");
      return;
    }

    const { error } = await createManualAdminBooking({
      fullName,
      email,
      phone,
      exam,
      subject,
      startsAt: new Date(`${date}T${startTime}:00`).toISOString(),
      endsAt: new Date(`${date}T${endTime}:00`).toISOString(),
      notes,
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

  const inputClass =
    "w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <CalendarPlus className="size-5 text-[#819586]" />
            <h2 className="text-sm font-bold text-ink">Randevu Oluştur</h2>
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

        <form onSubmit={submit} className="space-y-3.5">
          {/* Optional Existing Student Dropdown */}
          <div className="rounded-xl border border-primary/20 bg-forest/5 p-3">
            <label className="block space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <UserCheck className="size-3.5 text-primary" />
                Kayıtlı Öğrenci Seç (İsteğe Bağlı)
              </span>
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className={inputClass}
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
              Öğrenci seçildiğinde ad, e-posta ve telefon otomatik doldurulur ve randevu öğrenci hesabına bağlanır.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ad Soyad">
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Öğrenci Adı Soyadı"
                className={inputClass}
              />
            </Field>
            <Field label="E-posta">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@ogrenci.com"
                className={inputClass}
              />
            </Field>
            <Field label="Telefon">
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+90 5XX XXX XX XX"
                className={inputClass}
              />
            </Field>
            <Field label="Sınav / Alan">
              <input
                required
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                placeholder="SAT, IB, AP, Danışmanlık vb."
                className={inputClass}
              />
            </Field>
            <Field label="Ders / Konu">
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Örn: Birebir Matematik Görüşmesi"
                className={inputClass}
              />
            </Field>
            <Field label="Durum">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                className={inputClass}
              >
                <option value="confirmed">Onaylandı</option>
                <option value="pending">Bekliyor</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal</option>
                <option value="no_show">Gelmedi</option>
              </select>
            </Field>
            <Field label="Tarih">
              <input
                required
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Başlangıç">
                <input
                  required
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Bitiş">
                <input
                  required
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass}
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
                className={inputClass}
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
              className={inputClass}
            />
          </Field>

          {!selectedStudentId && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-background-soft/50 p-2.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                required
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>Kişinin verilerinin bu randevu için işlenmesine ilişkin gizlilik onayının alındığını doğruluyorum.</span>
            </label>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
