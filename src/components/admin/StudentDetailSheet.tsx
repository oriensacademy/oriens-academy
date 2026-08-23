"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Mail, Phone, X, BookOpen, ClipboardList, Package, Award, StickyNote, UserRound, LayoutDashboard } from "lucide-react";
import { StudentLearningManager, type LearningSection } from "@/components/admin/StudentLearningManager";
import { completeStudentAppointment } from "@/lib/admin/student-learning";
import { updateAdminBookingStatus } from "@/lib/admin/bookings";
import type { StudentProfile } from "@/lib/admin/students";
import { formatExamBadges, formatDestinationBadges } from "@/lib/student/preferences";

type Tab = "overview" | "profile" | "education" | "homework" | "packages" | "exam_history" | "notes";
const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Genel", icon: LayoutDashboard },
  { id: "profile", label: "Profil", icon: UserRound },
  { id: "education", label: "Eğitim", icon: BookOpen },
  { id: "homework", label: "Ödevler", icon: ClipboardList },
  { id: "packages", label: "Paket & Ödeme", icon: Package },
  { id: "exam_history", label: "Sınavlar", icon: Award },
  { id: "notes", label: "Notlar", icon: StickyNote },
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
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  useEffect(() => {
    if (!student) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [student, onClose]);
  if (!student || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
      {/* Fixed backdrop - clicking backdrop does NOT accidentally close the modal */}
      <div className="fixed inset-0 bg-ink/55 backdrop-blur-xs transition-opacity cursor-default" />

      <div className="relative z-10 flex h-[min(900px,92vh)] w-[min(1280px,94vw)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <header className="shrink-0 border-b border-border bg-surface px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-forest/10 font-heading text-lg font-bold text-primary">
                {student.fullName?.slice(0, 2).toUpperCase() || "ÖG"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="student-detail-title" className="font-heading text-xl font-bold text-ink">{student.fullName}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      student.active
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border border-red-300 bg-red-50 text-red-800"
                    }`}
                  >
                    {student.active ? "Aktif Öğrenci" : "Pasif"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {student.email} · {student.phone || "Telefon belirtilmemiş"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink cursor-pointer"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav aria-label="Öğrenci detay bölümleri" className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    tab === item.id
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-border bg-white text-muted-foreground hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
          {message && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium">
              {message}
            </div>
          )}
          {tab === "overview" && <Overview student={student} onCreateBooking={onCreateBooking} />}
          {tab === "profile" && <ProfileView student={student} />}
          {tab === "education" && <div className="space-y-6"><Appointments student={student} onCreateBooking={onCreateBooking} onDone={(text) => { setMessage(text); onChanged?.(); }} />{student.userId && <StudentLearningManager userId={student.userId} section="lessons" onChanged={onChanged} onPlan={onCreateBooking} />}</div>}
          {tab === "packages" && student.userId && <div className="space-y-6"><StudentLearningManager userId={student.userId} section="packages" onChanged={onChanged} /><StudentLearningManager userId={student.userId} section="payments" onChanged={onChanged} /></div>}
          {(["homework", "exam_history", "notes"] as Tab[]).includes(tab) && student.userId && (
            <StudentLearningManager userId={student.userId} studentName={student.fullName} section={tab as LearningSection} onChanged={onChanged} />
          )}
          {(["education", "homework", "packages", "exam_history", "notes"] as Tab[]).includes(tab) && !student.userId && (
            <NoAccount />
          )}
        </div>
      </div>
    </div>, document.body
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
          Ders / Görüşme Planla
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

function ProfileView({ student }: { student: StudentProfile }) {
  const exams = formatExamBadges(student.targetExams);
  const countries = formatDestinationBadges(student.targetCountries);
  const value = (input: string | null | undefined) => input?.trim() || "Belirtilmemiş";
  return <div className="space-y-6">
    <ReadOnlySection title="Kişisel Bilgiler"><Info label="Ad Soyad" value={value(student.fullName)} /><Info label="E-posta" value={value(student.email)} /><Info label="Telefon" value={value(student.phone)} /></ReadOnlySection>
    <ReadOnlySection title="Eğitim Bilgileri"><Info label="Okul" value={value(student.school)} /><Info label="Hedef Üniversite" value={value(student.targetUniversity)} /><Info label="Tercih Edilen Dil" value={student.preferredLanguage === "en" ? "English" : "Türkçe"} /></ReadOnlySection>
    <BadgeSection title="Hedef Sınavlar" values={exams} />
    <BadgeSection title="Hedef Ülkeler" values={countries} />
  </div>;
}

function ReadOnlySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3><div className="grid gap-3 sm:grid-cols-3">{children}</div></section>;
}

function BadgeSection({ title, values }: { title: string; values: string[] }) {
  return <section><h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3><div className="flex min-h-12 flex-wrap gap-2 rounded-xl border border-border bg-white p-3">{values.length ? values.map((item) => <span key={item} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{item}</span>) : <span className="text-sm text-muted-foreground">Belirtilmemiş</span>}</div></section>;
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
        Ders / Görüşme Planla
      </button>
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <h3 className="text-xs font-bold text-ink">Yaklaşan Ders / Randevu</h3>
      {student.bookings.some((b) => !["completed", "cancelled", "no_show"].includes(b.status)) ? (
        student.bookings.filter((b) => !["completed", "cancelled", "no_show"].includes(b.status)).map((b) => (
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
      ) : <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">Yaklaşan ders veya randevu yok.</div>}
      <h3 className="pt-2 text-xs font-bold text-ink">Geçmiş Ders / Randevular</h3>
      {student.bookings.filter((b) => ["completed", "cancelled", "no_show"].includes(b.status)).map((b) => <div key={b.id} className="rounded-xl border border-border p-3 text-xs"><strong>{b.appointment_subject || b.exam_code || b.custom_exam || "Genel danışmanlık"}</strong><p className="mt-1 text-muted-foreground">{date(b.availability_slots?.starts_at || b.created_at)} · {b.status}</p></div>)}
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
const action = "inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted";
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
    : "—";
}
