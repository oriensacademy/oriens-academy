import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  CalendarPlus,
  Mail,
  Phone,
  X,
  BookOpen,
  Package,
  StickyNote,
  LayoutDashboard,
  KeyRound,
  Video,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Lock,
} from "lucide-react";
import { StudentLearningManager, type LearningSection } from "@/components/admin/StudentLearningManager";
import { completeStudentAppointment } from "@/lib/admin/student-learning";
import { updateAdminBookingStatus } from "@/lib/admin/bookings";
import {
  sendStudentPasswordReset,
  adminUpdateStudentProfile,
  type StudentProfile,
} from "@/lib/admin/students";
import { useAccount } from "@/lib/auth/account-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatExamBadges, formatDestinationBadges } from "@/lib/student/preferences";

type Tab = "overview" | "education" | "packages" | "notes";
const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Genel", icon: LayoutDashboard },
  { id: "education", label: "Eğitim", icon: BookOpen },
  { id: "packages", label: "Paket & Ödeme", icon: Package },
  { id: "notes", label: "Notlar", icon: StickyNote },
];

export function StudentDetailSheet({
  student,
  initialTab = "overview",
  onClose,
  onCreateBooking,
  onChanged,
}: {
  student: StudentProfile | null;
  initialTab?: Tab;
  onClose: () => void;
  onCreateBooking: () => void;
  onChanged?: () => void;
}) {
  const { user: currentAdminUser } = useAccount();
  const adminEmail = currentAdminUser?.email || "admin@oriens-academy.com";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isResetting, startResetTransition] = useTransition();

  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  useEffect(() => {
    if (!student) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editModalOpen) setEditModalOpen(false);
        else if (resetModalOpen) setResetModalOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [student, onClose, resetModalOpen, editModalOpen]);

  if (!student || !mounted || typeof document === "undefined") return null;

  const handlePasswordReset = () => {
    startResetTransition(async () => {
      setMessage("");
      setErrorMessage("");
      const res = await sendStudentPasswordReset(student.email, (student.preferredLanguage as "tr" | "en") || "tr");
      if (res.success) {
        setMessage(`Şifre sıfırlama bağlantısı başarıyla ${student.email} adresine iletildi.`);
        setResetModalOpen(false);
      } else {
        setErrorMessage(res.error || "Şifre sıfırlama bağlantısı gönderilemedi.");
      }
    });
  };

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
            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
              <span>{message}</span>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium animate-in fade-in">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <span>{errorMessage}</span>
            </div>
          )}

          {tab === "overview" && (
            <Overview
              student={student}
              onCreateBooking={onCreateBooking}
              onOpenPasswordReset={() => {
                setErrorMessage("");
                setResetModalOpen(true);
              }}
              onOpenEditIdentity={() => {
                setErrorMessage("");
                setEditModalOpen(true);
              }}
            />
          )}

          {tab === "education" && (
            <Appointments
              student={student}
              onCreateBooking={onCreateBooking}
              onSelectTab={(t) => setTab(t)}
              onDone={(text) => {
                setMessage(text);
                onChanged?.();
              }}
            />
          )}

          {tab === "packages" && student.userId && (
            <div className="space-y-6">
              <StudentLearningManager userId={student.userId} section="packages" onChanged={onChanged} />
              <StudentLearningManager userId={student.userId} section="payments" onChanged={onChanged} />
            </div>
          )}

          {tab === "notes" && student.userId && (
            <StudentLearningManager
              userId={student.userId}
              studentName={student.fullName}
              section={tab as LearningSection}
              onChanged={onChanged}
            />
          )}

          {(["education", "packages", "notes"] as Tab[]).includes(tab) && !student.userId && (
            <NoAccount />
          )}
        </div>
      </div>

      {/* Password Reset Confirmation Dialog */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="alertdialog">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-ink">Şifre Sıfırlama Bağlantısı</h3>
                <p className="text-xs text-muted-foreground">{student.fullName}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/60 p-3.5 text-xs text-ink/80 space-y-2">
              <p>
                <strong>{student.email}</strong> adresine güvenli şifre sıfırlama bağlantısı gönderilecektir.
              </p>
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-700 mt-0.5" />
                <span>
                  Yönetici panelinde hiçbir düz metin geçici şifre oluşturulmaz veya görüntülenmez. Öğrenci kendi şifresini güvenle belirler.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setResetModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handlePasswordReset}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
              >
                <KeyRound className="size-3.5" />
                {isResetting ? "Gönderiliyor..." : "Bağlantıyı Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Identity & Profile Edit Modal with Admin Re-authentication */}
      {editModalOpen && (
        <EditStudentIdentityModal
          student={student}
          adminEmail={adminEmail}
          onClose={() => setEditModalOpen(false)}
          onSuccess={(msg) => {
            setMessage(msg);
            onChanged?.();
          }}
        />
      )}
    </div>,
    document.body
  );
}

function Overview({
  student,
  onCreateBooking,
  onOpenPasswordReset,
  onOpenEditIdentity,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onOpenPasswordReset: () => void;
  onOpenEditIdentity: () => void;
}) {
  const val = (input: string | null | undefined) => input?.trim() || "Belirtilmemiş";
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
    <div className="space-y-6">
      {/* KİŞİSEL BİLGİLER (READ-ONLY WITH SECURE ADMIN EDIT) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Kişisel Bilgiler
          </h3>
          <button
            type="button"
            onClick={onOpenEditIdentity}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer shadow-2xs transition-colors"
          >
            <Edit3 className="size-3 text-primary" />
            <span>Bilgileri Düzenle</span>
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Ad Soyad" value={val(student.fullName)} />
          <Info label="E-posta" value={val(student.email)} />
          <Info label="Telefon" value={val(student.phone)} />
          <div className="rounded-xl border border-border bg-background-soft/50 p-3">
            <span className="block text-[9px] uppercase text-muted-foreground font-semibold">Öğrenci Durumu</span>
            <div className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  student.active
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border border-red-300 bg-red-50 text-red-800"
                }`}
              >
                {student.active ? "Aktif Öğrenci" : "Pasif"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* AKADEMİK PROFİL (READ-ONLY) */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Akademik Profil
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Okul" value={val(student.school)} />
          <Info label="Hedef Üniversite" value={val(student.targetUniversity)} />
          <Info
            label="Tercih Edilen Dil"
            value={student.preferredLanguage === "en" ? "İngilizce" : "Türkçe"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background-soft/50 p-3.5 space-y-1.5">
            <span className="block text-[9px] uppercase font-semibold text-muted-foreground">Hedef Sınavlar</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {examBadges.length > 0 ? (
                examBadges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                  >
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Belirtilmemiş</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background-soft/50 p-3.5 space-y-1.5">
            <span className="block text-[9px] uppercase font-semibold text-muted-foreground">Hedef Ülkeler</span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {countryBadges.length > 0 ? (
                countryBadges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                  >
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Belirtilmemiş</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PAKET VE RANDEVU ÖZETİ */}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Eğitim & Aktivite Özeti
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Aktif Paket" value={student.activePackage?.name || "Tanımlı Paket Yok"} />
          <Info
            label="Kalan Ders"
            value={
              student.activePackage
                ? `${Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed)} ders`
                : "—"
            }
          />
          <Info label="Sonraki Randevu" value={date(student.nextAppointment)} />
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <a href={`mailto:${student.email}`} className={action}>
          <Mail className="size-4" />
          E-posta Gönder
        </a>
        {student.phone && (
          <a href={`tel:${student.phone}`} className={action}>
            <Phone className="size-4" />
            Ara
          </a>
        )}
        <button
          onClick={onCreateBooking}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors"
        >
          <CalendarPlus className="size-4" />
          Ders / Görüşme Planla
        </button>
        <button
          onClick={onOpenPasswordReset}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer transition-colors"
        >
          <KeyRound className="size-4 text-amber-700" />
          Şifre Sıfırlama Bağlantısı Gönder
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface-muted/40 p-4">
        <h4 className="text-xs font-bold text-ink">Etkileşim Kayıtları</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {student.contacts.length} iletişim talebi · {student.bookings.length} randevu / ders seansı · {student.deliveries.length} bildirim teslimatı
        </p>
      </div>
    </div>
  );
}

function Appointments({
  student,
  onCreateBooking,
  onSelectTab,
  onDone,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onSelectTab?: (tab: Tab) => void;
  onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const hasActivePackage = Boolean(student.activePackage);
  const remainingLessons = student.activePackage ? Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed) : 0;

  async function finish(id: string, asLesson: boolean) {
    setBusy(id);
    setError("");
    if (asLesson) {
      const r = await completeStudentAppointment({
        bookingId: id,
        packagePurchaseId: hasActivePackage && remainingLessons > 0 ? (student.activePackage?.id || null) : null,
        title: `${student.targetExam || "Akademik"} dersi`,
        subject: student.targetExam || "Genel akademik çalışma",
        examCode: student.targetExam || "",
        durationMinutes: 60,
        teacherNote: "",
      });
      if (r.error) {
        setError(r.error);
      } else {
        onDone(
          r.alreadyCompleted
            ? "Bu randevu daha önce ders olarak tamamlanmış; paket yeniden düşülmedi."
            : hasActivePackage && remainingLessons > 0
            ? "Ders tamamlandı, 1 ders paketten düşüldü ve geçmişe işlendi."
            : "Ders paketsiz olarak tamamlandı ve geçmişe işlendi."
        );
      }
    } else {
      const r = await updateAdminBookingStatus(id, "completed");
      if (r.error) setError(r.error);
      else onDone("Görüşme/randevu tamamlandı (Paket düşülmedi).");
    }
    setBusy("");
  }

  async function cancelAppointment(id: string) {
    setBusy(id);
    setError("");
    const r = await updateAdminBookingStatus(id, "cancelled");
    if (r.error) setError(r.error);
    else onDone("Randevu iptal edildi.");
    setBusy("");
  }

  const upcoming = student.bookings.filter((b) => !["completed", "cancelled", "no_show"].includes(b.status));
  const past = student.bookings.filter((b) => ["completed", "cancelled", "no_show"].includes(b.status));

  return (
    <div className="space-y-5">
      {/* Top Header with ONE single CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-ink">Ders & Randevu Yönetimi</h3>
          <p className="text-xs text-muted-foreground">
            Öğrencinin yaklaşan ve geçmiş ders/görüşme seanslarını yönetin ve yeni seans planlayın.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateBooking}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors shadow-xs"
        >
          <CalendarPlus className="size-4" />
          Ders / Görüşme Planla
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Yaklaşan Ders & Randevular */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Yaklaşan Seanslar ({upcoming.length})
        </h4>
        {upcoming.length > 0 ? (
          upcoming.map((b) => {
            const hasMeetingLink = Boolean(b.live_meeting_url);
            const isExplicitLesson = b.event_type === "lesson" || (b.appointment_subject && (b.appointment_subject.startsWith("[Ders]") || b.appointment_subject.toLowerCase().includes("ders")));
            const isConsultation = b.event_type === "discovery" || b.event_type === "consultation" || (b.appointment_subject && (b.appointment_subject.startsWith("[Ön Görüşme]") || b.appointment_subject.startsWith("[Danışmanlık]")));

            return (
              <div key={b.id} className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-3 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-ink">
                        {b.appointment_subject || b.exam_code || b.custom_exam || "Birebir Seans"}
                      </strong>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {b.status === "confirmed" ? "Onaylandı" : b.status === "pending" ? "Bekliyor" : b.status}
                      </span>
                      {isExplicitLesson ? (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Ders
                        </span>
                      ) : isConsultation ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Görüşme / Danışmanlık
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {date(b.availability_slots?.starts_at || b.created_at)}
                      {b.availability_slots?.ends_at ? ` — ${new Date(b.availability_slots.ends_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action buttons based on event type & entitlement */}
                    {isExplicitLesson ? (
                      hasActivePackage && remainingLessons > 0 ? (
                        <button
                          type="button"
                          disabled={busy === b.id}
                          onClick={() => void finish(b.id, true)}
                          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          Dersi Tamamla (Paketten 1 Ders Düş)
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                            {hasActivePackage ? "Paket Bakiyesi: 0 Ders" : "Aktif Paket Yok"}
                          </span>
                          {onSelectTab && (
                            <button
                              type="button"
                              onClick={() => onSelectTab("packages")}
                              className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 cursor-pointer transition-colors"
                            >
                              Paket / Ek Ders Tanımla
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy === b.id}
                            onClick={() => void finish(b.id, true)}
                            className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer disabled:opacity-50"
                            title="Paketten düşmeden ders tamamlandı olarak kaydet"
                          >
                            Paketsiz Tamamla
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={busy === b.id}
                        onClick={() => void finish(b.id, false)}
                        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Görüşmeyi Tamamla
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy === b.id}
                      onClick={() => void cancelAppointment(b.id)}
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      İptal Et
                    </button>
                  </div>
                </div>

                {/* Live Meeting URL Box */}
                {hasMeetingLink && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-forest/5 p-3">
                    <div className="flex items-center gap-2 text-ink">
                      <Video className="size-4 text-primary" />
                      <span className="font-semibold">Görüşme Bağlantısı:</span>
                      <a
                        href={b.live_meeting_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-primary underline break-all flex items-center gap-1 hover:text-forest"
                      >
                        {b.live_meeting_url}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </div>
                    <a
                      href={b.live_meeting_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest"
                    >
                      <Video className="size-3.5" />
                      Görüşmeye Katıl
                    </a>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-surface-muted/30">
            Yaklaşan planlanmış ders veya randevu bulunmuyor.
          </div>
        )}
      </div>

      {/* Geçmiş Ders & Randevular */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Geçmiş Seanslar ({past.length})
        </h4>
        {past.length > 0 ? (
          past.map((b) => (
            <div key={b.id} className="rounded-2xl border border-border bg-surface p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-ink">
                    {b.appointment_subject || b.exam_code || b.custom_exam || "Birebir Seans"}
                  </strong>
                  <p className="mt-0.5 text-muted-foreground">
                    {date(b.availability_slots?.starts_at || b.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    b.status === "completed"
                      ? "bg-emerald-100 text-emerald-800"
                      : b.status === "cancelled"
                      ? "bg-neutral-200 text-neutral-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {b.status === "completed" ? "Tamamlandı" : b.status === "cancelled" ? "İptal Edildi" : b.status === "no_show" ? "Gelmedi" : b.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-surface-muted/30">
            Geçmiş seans kaydı bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

function NoAccount() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900 leading-relaxed">
      Bu kişi henüz doğrulanmış bir öğrenci hesabına bağlı değil. Ders, ödev, paket, ödeme ve özel not işlevleri öğrenci
      hesabı oluşturulduktan sonra açılır.
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background-soft/50 p-3">
      <span className="block text-[9px] uppercase font-semibold text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-words text-xs text-ink">{value}</strong>
    </div>
  );
}

const action =
  "inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer";

function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
    : "—";
}

function EditStudentIdentityModal({
  student,
  adminEmail,
  onClose,
  onSuccess,
}: {
  student: StudentProfile;
  adminEmail: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: student.fullName || "",
    phone: student.phone || "",
    school: student.school || "",
    targetUniversity: student.targetUniversity || "",
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [step, setStep] = useState<"edit" | "reauth">("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError("Ad Soyad alanı zorunludur.");
      return;
    }
    setError("");
    setStep("reauth");
  };

  const handleConfirmUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      setError("Lütfen yönetici şifrenizi girin.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      // Re-authenticate admin credentials securely (passwords never logged/stored)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (authError) {
        setBusy(false);
        setError("Yönetici şifresi doğrulanamadı. Lütfen kontrol edip tekrar deneyin.");
        return;
      }

      const targetId = student.userId || student.id.replace("account-", "");
      const res = await adminUpdateStudentProfile(targetId, {
        fullName: form.fullName,
        phone: form.phone || null,
        school: form.school || null,
        targetUniversity: form.targetUniversity || null,
      });

      setBusy(false);
      if (!res.success) {
        setError(res.error || "Öğrenci bilgileri güncellenemedi.");
      } else {
        onSuccess("Öğrenci bilgileri başarıyla güncellendi.");
        onClose();
      }
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "İşlem sırasında bir hata oluştu.");
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
              <Edit3 className="size-4" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">Öğrenci Bilgilerini Düzenle</h3>
              <p className="text-xs text-muted-foreground">{student.fullName} ({student.email})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "edit" ? (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ink">
                Ad Soyad <span className="text-red-500">*</span>
                <input
                  required
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>

              <label className="text-xs font-semibold text-ink">
                Telefon Numarası
                <input
                  type="tel"
                  placeholder="05..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>

              <label className="text-xs font-semibold text-ink">
                Okul / Kurum
                <input
                  type="text"
                  placeholder="Örn: Robert Kolej"
                  value={form.school}
                  onChange={(e) => setForm({ ...form, school: e.target.value })}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>

              <label className="text-xs font-semibold text-ink">
                Hedef Üniversite
                <input
                  type="text"
                  placeholder="Örn: Oxford University"
                  value={form.targetUniversity}
                  onChange={(e) => setForm({ ...form, targetUniversity: e.target.value })}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              <span>Kimlik değişiklikleri denetim kaydına yazılır ve yönetici şifre doğrulaması gerektirir.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest cursor-pointer shadow-xs"
              >
                Devam Et &rarr;
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmUpdate} className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                <Lock className="size-4 text-amber-700" />
                <span>Yönetici Şifre Doğrulaması (Re-authentication)</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Öğrenci kimlik bilgilerini güncellemek hassas bir işlemdir. Devam etmek için aktif yönetici hesabınızın ({adminEmail}) şifresini girin.
              </p>
            </div>

            <label className="block text-xs font-semibold text-ink">
              Yönetici Şifreniz
              <input
                required
                autoFocus
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <button
                type="button"
                disabled={busy}
                onClick={() => { setStep("edit"); setAdminPassword(""); setError(""); }}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
              >
                &larr; Geri Dön
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="size-3.5" />
                  {busy ? "Doğrulanıyor ve Kaydediliyor..." : "Doğrula ve Güncelle"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
