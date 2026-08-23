"use client";

import { useState } from "react";
import { CalendarPlus, Check, Globe, GraduationCap, Mail, Phone, X } from "lucide-react";
import { StudentLearningManager, type LearningSection } from "@/components/admin/StudentLearningManager";
import { completeStudentAppointment, updateAdminStudentProfile } from "@/lib/admin/student-learning";
import { updateAdminBookingStatus } from "@/lib/admin/bookings";
import type { StudentProfile } from "@/lib/admin/students";
import { SUPPORTED_EXAMS, SUPPORTED_DESTINATIONS, formatExamBadges, formatDestinationBadges } from "@/lib/student/preferences";

type Tab = "overview" | "profile" | "appointments" | LearningSection;
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Genel" },
  { id: "profile", label: "Profil" },
  { id: "appointments", label: "Randevular" },
  { id: "lessons", label: "Dersler" },
  { id: "homework", label: "Ödevler" },
  { id: "packages", label: "Paketler" },
  { id: "payments", label: "Ödemeler" },
  { id: "exam_history", label: "Sınav Geçmişi" },
  { id: "notes", label: "Notlar" },
];

export function StudentDetailSheet({
  student,
  onClose,
  onCreateBooking,
  onChanged,
}: {
  student: StudentProfile | null;
  onClose: () => void;
  onCreateBooking: () => void;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-forest/30 backdrop-blur-xs" />
      <aside className="relative z-10 h-full w-full overflow-y-auto border-l border-border bg-white shadow-2xl sm:max-w-3xl">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{student.fullName}</h2>
              <p className="text-xs text-muted-foreground">
                {student.email} · {student.phone || "Telefon yok"}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <nav aria-label="Öğrenci detay bölümleri" className="mt-4 flex gap-1 overflow-x-auto pb-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                  tab === item.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          {message && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              {message}
            </div>
          )}
          {tab === "overview" && <Overview student={student} onCreateBooking={onCreateBooking} />}
          {tab === "profile" && (
            <ProfileForm
              student={student}
              onDone={() => {
                setMessage("Öğrenci profili güncellendi.");
                onChanged?.();
              }}
            />
          )}
          {tab === "appointments" && (
            <Appointments
              student={student}
              onCreateBooking={onCreateBooking}
              onDone={(text) => {
                setMessage(text);
                onChanged?.();
              }}
            />
          )}
          {(["lessons", "homework", "packages", "payments", "exam_history", "notes"] as Tab[]).includes(tab) && student.userId && (
            <StudentLearningManager userId={student.userId} section={tab as LearningSection} onChanged={onChanged} />
          )}
          {(["lessons", "homework", "packages", "payments", "exam_history", "notes"] as Tab[]).includes(tab) && !student.userId && (
            <NoAccount />
          )}
        </div>
      </aside>
    </div>
  );
}

function Overview({ student, onCreateBooking }: { student: StudentProfile; onCreateBooking: () => void }) {
  const examBadges = formatExamBadges(
    student.targetExams && student.targetExams.length > 0
      ? student.targetExams
      : student.targetExam
      ? [student.targetExam]
      : []
  );
  const countryBadges = formatDestinationBadges(
    student.targetCountries && student.targetCountries.length > 0
      ? student.targetCountries
      : student.targetCountry
      ? [student.targetCountry]
      : []
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-background-soft/50 p-3">
          <span className="block text-[9px] uppercase text-muted-foreground">Hedef Sınavlar</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {examBadges.length > 0 ? (
              examBadges.map((b) => (
                <span
                  key={b}
                  className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                >
                  {b}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background-soft/50 p-3">
          <span className="block text-[9px] uppercase text-muted-foreground">Hedef Ülkeler</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {countryBadges.length > 0 ? (
              countryBadges.map((b) => (
                <span
                  key={b}
                  className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                >
                  {b}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <Info label="Aktif Paket" value={student.activePackage?.name || "—"} />
        <Info
          label="Kalan Ders"
          value={
            student.activePackage
              ? String(Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed))
              : "—"
          }
        />
        <Info label="Bekleyen Ödev" value={String(student.pendingHomework)} />
        <Info label="Okul" value={student.school || "—"} />
        <Info label="Hedef Üniversite" value={student.targetUniversity || "—"} />
        <Info label="Son Randevu" value={date(student.latestAppointment)} />
        <Info label="Sonraki Randevu" value={date(student.nextAppointment)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`mailto:${student.email}`} className={action}>
          <Mail className="size-4" />
          E-posta
        </a>
        {student.phone && (
          <a href={`tel:${student.phone}`} className={action}>
            <Phone className="size-4" />
            Ara
          </a>
        )}
        <button
          onClick={onCreateBooking}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-forest"
        >
          <CalendarPlus className="size-4" />
          Randevu Oluştur
        </button>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="text-xs font-bold text-ink">İletişim Geçmişi</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {student.contacts.length} iletişim talebi · {student.bookings.length} randevu · {student.deliveries.length} bildirim teslimatı
        </p>
      </div>
    </div>
  );
}

function ProfileForm({ student, onDone }: { student: StudentProfile; onDone: () => void }) {
  const [form, setForm] = useState({
    fullName: student.fullName,
    phone: student.phone || "",
    school: student.school || "",
    targetExam: student.targetExam || "",
    targetUniversity: student.targetUniversity || "",
    targetCountry: student.targetCountry || "",
    preferredLanguage: student.preferredLanguage,
    active: student.active,
  });

  const [selectedExams, setSelectedExams] = useState<string[]>(
    student.targetExams && student.targetExams.length > 0
      ? student.targetExams
      : student.targetExam
      ? [student.targetExam]
      : []
  );

  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    student.targetCountries && student.targetCountries.length > 0
      ? student.targetCountries
      : student.targetCountry
      ? [student.targetCountry]
      : []
  );

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!student.userId) return <NoAccount />;

  const toggleExam = (id: string) => {
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleCountry = (id: string) => {
    setSelectedCountries((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!student.userId) return;
    setBusy(true);
    setError("");

    const r = await updateAdminStudentProfile(student.userId, {
      ...form,
      targetExam: selectedExams[0] || form.targetExam,
      targetCountry: selectedCountries[0] || form.targetCountry,
    });

    setBusy(false);
    if (r.error) setError(r.error);
    else onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad soyad" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
        <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Okul" value={form.school} onChange={(v) => setForm({ ...form, school: v })} />
        <Field
          label="Hedef üniversite"
          value={form.targetUniversity}
          onChange={(v) => setForm({ ...form, targetUniversity: v })}
        />
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Tercih edilen dil
          <select
            value={form.preferredLanguage}
            onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
            className={input}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-xs font-semibold">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Aktif öğrenci
        </label>
      </div>

      {/* Target Exams Multi-Selection */}
      <div className="rounded-xl border border-border p-3.5 space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <GraduationCap className="size-4 text-primary" />
          <span>Hedef Sınavlar ({selectedExams.length} seçili)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_EXAMS.map((ex) => {
            const isSelected = selectedExams.includes(ex.id);
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => toggleExam(ex.id)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                }`}
              >
                {isSelected && <Check className="size-3" />}
                <span>{ex.name_tr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Destinations Multi-Selection */}
      <div className="rounded-xl border border-border p-3.5 space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Globe className="size-4 text-emerald-700" />
          <span>Hedef Ülkeler ({selectedCountries.length} seçili)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_DESTINATIONS.map((dest) => {
            const isSelected = selectedCountries.includes(dest.id);
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => toggleCountry(dest.id)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  isSelected
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                }`}
              >
                {isSelected && <Check className="size-3" />}
                <span>{dest.name_tr}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        E-posta, doğrulanmış kimlik hesabına bağlıdır ve bu formdan değiştirilemez.
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button
        disabled={busy}
        className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50"
      >
        {busy ? "Kaydediliyor…" : "Profili Kaydet"}
      </button>
    </form>
  );
}

function Appointments({
  student,
  onCreateBooking,
  onDone,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function finish(id: string, asLesson: boolean) {
    setBusy(id);
    setError("");
    if (asLesson) {
      const r = await completeStudentAppointment({
        bookingId: id,
        packagePurchaseId: student.activePackage?.id || null,
        title: `${student.targetExam || "Akademik"} dersi`,
        subject: student.targetExam || "Genel akademik çalışma",
        examCode: student.targetExam || "",
        durationMinutes: 60,
        teacherNote: "",
      });
      if (r.error) setError(r.error);
      else
        onDone(
          r.alreadyCompleted
            ? "Bu randevu daha önce ders olarak tamamlanmış; paket yeniden düşülmedi."
            : "Randevu tamamlandı, ders geçmişi ve paket kullanımı işlendi."
        );
    } else {
      const r = await updateAdminBookingStatus(id, "completed");
      if (r.error) setError(r.error);
      else onDone("Randevu ders/paket kaydı oluşturmadan tamamlandı.");
    }
    setBusy("");
  }
  return (
    <div className="space-y-3">
      <button
        onClick={onCreateBooking}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-forest"
      >
        <CalendarPlus className="size-4" />
        Yeni Randevu
      </button>
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {student.bookings.length ? (
        student.bookings.map((b) => (
          <div key={b.id} className="rounded-xl border border-border p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <strong>{b.exam_code || b.custom_exam || "Genel danışmanlık"}</strong>
                <p className="mt-1 text-muted-foreground">
                  {date(b.availability_slots?.starts_at || b.created_at)} · {b.status}
                </p>
              </div>
              {!["completed", "cancelled", "no_show"].includes(b.status) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy === b.id}
                    onClick={() => void finish(b.id, false)}
                    className="rounded border border-border px-2 py-1 hover:bg-muted"
                  >
                    Yalnız randevuyu tamamla
                  </button>
                  {student.userId && (
                    <button
                      disabled={busy === b.id}
                      onClick={() => void finish(b.id, true)}
                      className="rounded bg-ink px-2 py-1 text-white hover:bg-forest"
                    >
                      Ders olarak tamamla
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">Randevu kaydı yok.</div>
      )}
    </div>
  );
}

function NoAccount() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
      Bu kişi henüz doğrulanmış bir öğrenci hesabına bağlı değil. Ders, ödev, paket, ödeme ve özel not işlevleri öğrenci
      hesabı oluşturulduktan sonra açılır.
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background-soft/50 p-3">
      <span className="block text-[9px] uppercase text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words text-xs text-ink">{value}</strong>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
      {label}
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)} className={input} />
    </label>
  );
}
const input =
  "min-h-9 w-full rounded-lg border border-input bg-white px-3 text-xs text-foreground focus:border-primary focus:outline-hidden";
const action = "inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted";
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
    : "—";
}
