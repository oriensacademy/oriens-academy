import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  CalendarPlus,
  Mail,
  Info as InfoIcon,
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
  Edit3,
  Lock,
  History,
  MinusCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { StudentLearningManager } from "@/components/admin/StudentLearningManager";
import { useToast } from "@/components/ui/toast";
import { completeStudentAppointment, recordCompletedLesson, upsertStudentLesson, adjustStudentPackageLessons } from "@/lib/admin/student-learning";
import { updateAdminBookingStatus, updateAdminBookingEvent, sendAdminBookingNotification, type BookingWithSlot } from "@/lib/admin/bookings";
import {
  sendStudentPasswordReset,
  adminUpdateStudentProfile,
  type StudentProfile,
} from "@/lib/admin/students";
import { useAccount } from "@/lib/auth/account-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatExamBadges, formatDestinationBadges } from "@/lib/student/preferences";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

type Tab = "overview" | "education" | "packages" | "notes";
const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Genel", icon: LayoutDashboard },
  { id: "education", label: "Eğitim", icon: BookOpen },
  { id: "packages", label: "Paket & Ödeme", icon: Package },
  { id: "notes", label: "Notlar", icon: StickyNote },
];

export function StudentDetailSheet({
  student: studentProp,
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
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  // Every tab a user has actually opened stays mounted (hidden via CSS, not
  // unmounted) for the lifetime of this sheet, so revisiting a tab is instant
  // and never re-fetches -- see "TAB GEÇİŞLERİNDE FULL LOADING SORUNU".
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set([initialTab]));
  const [errorMessage, setErrorMessage] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [recordLessonModalOpen, setRecordLessonModalOpen] = useState(false);
  const [decreaseRightsModalOpen, setDecreaseRightsModalOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingWithSlot | null>(null);
  const [isResetting, startResetTransition] = useTransition();

  // Optimistic local copy of the student: mutation handlers patch this
  // immediately so the UI never waits on the parent list's full refetch
  // (see "DERS İPTAL UI STATE BUG" / "DERS PLANLAMA PERFORMANSI"). It
  // re-syncs whenever the parent hands us fresh authoritative data for the
  // same student (background reconciliation), and resets on mount for a
  // different student since <StudentDetailSheet key={selected.id}> remounts
  // this component when the selection changes.
  const [localStudent, setLocalStudent] = useState(studentProp);
  // React's documented "adjust state during render" pattern (not an Effect):
  // reconcile with the parent's latest data the moment the prop reference
  // changes, in the same render pass -- avoids the extra render (and the
  // set-state-in-effect lint error) a useEffect-based sync would cause.
  const [reconciledStudentProp, setReconciledStudentProp] = useState(studentProp);
  if (studentProp !== reconciledStudentProp) {
    setReconciledStudentProp(studentProp);
    if (studentProp) setLocalStudent(studentProp);
  }

  function patchBooking(bookingId: string, patch: Partial<BookingWithSlot> | null) {
    setLocalStudent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookings: patch === null
          ? prev.bookings.filter((b) => b.id !== bookingId)
          : prev.bookings.map((b) => (b.id === bookingId ? { ...b, ...patch } : b)),
      };
    });
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    // Error banners are tab-scoped and must not follow the user to another
    // tab -- see "CANCELLED LESSON HER TABDA MESAJ GÖSTERME BUG".
    // Success feedback now uses the global toast system which is independent.
    setErrorMessage("");
    setVisitedTabs((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }

  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  useEffect(() => {
    if (!studentProp) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (decreaseRightsModalOpen) setDecreaseRightsModalOpen(false);
        else if (recordLessonModalOpen) setRecordLessonModalOpen(false);
        else if (editModalOpen) setEditModalOpen(false);
        else if (resetModalOpen) setResetModalOpen(false);
        else if (rescheduleBooking) setRescheduleBooking(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const unlockBodyScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockBodyScroll();
    };
  }, [studentProp, onClose, resetModalOpen, editModalOpen, decreaseRightsModalOpen, recordLessonModalOpen, rescheduleBooking]);

  if (!studentProp || !localStudent || !mounted || typeof document === "undefined") return null;
  // Everything below reads the optimistically-patched local copy.
  const student = localStudent;

  const handlePasswordReset = () => {
    startResetTransition(async () => {
      setErrorMessage("");
      const res = await sendStudentPasswordReset(student.email, (student.preferredLanguage as "tr" | "en") || "tr");
      if (res.success) {
        toast.success(`Şifre sıfırlama bağlantısı başarıyla ${student.email} adresine iletildi.`);
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
                  {student.email}
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
                  onClick={() => handleTabChange(item.id)}
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
          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium animate-in fade-in">
              <AlertCircle className="size-4 shrink-0 text-red-700" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Each tab mounts once (on first visit) and then stays mounted --
              switching away just hides it with CSS, so previously-loaded
              data and in-flight state are never lost and revisiting is
              instant. See "TAB GEÇİŞLERİNDE FULL LOADING SORUNU". */}
          {visitedTabs.has("overview") && (
            <div className={tab === "overview" ? "" : "hidden"}>
              <Overview
                student={student}
                onCreateBooking={onCreateBooking}
                onOpenRecordPastLesson={() => {
                  setErrorMessage("");
                  setRecordLessonModalOpen(true);
                }}
                onOpenDecreaseRights={() => {
                  setErrorMessage("");
                  setDecreaseRightsModalOpen(true);
                }}
                onOpenPasswordReset={() => {
                  setErrorMessage("");
                  setResetModalOpen(true);
                }}
                onOpenEditIdentity={() => {
                  setErrorMessage("");
                  setEditModalOpen(true);
                }}
              />
            </div>
          )}

          {visitedTabs.has("education") && (
            <div className={tab === "education" ? "" : "hidden"}>
              <Appointments
                student={student}
                onCreateBooking={onCreateBooking}
                onOpenRecordPastLesson={() => {
                  setErrorMessage("");
                  setRecordLessonModalOpen(true);
                }}
                onOpenDecreaseRights={() => {
                  setErrorMessage("");
                  setDecreaseRightsModalOpen(true);
                }}
                onPatchBooking={patchBooking}
                onOpenReschedule={(booking) => setRescheduleBooking(booking)}
                onDone={(text) => {
                  toast.success(text);
                  onChanged?.();
                }}
              />

              {/* Canlı ders kayıtları: MAIL-026 (bağlantı) ve MAIL-027 (ders
                  bilgilendirme) manuel gönderim aksiyonları burada yaşar. Bu
                  panel daha önce hiçbir yerde render edilmiyordu, dolayısıyla
                  ilgili manuel e-posta butonlarına UI'dan erişilemiyordu. */}
              {student.userId && (
                <div className="mt-6">
                  <StudentLearningManager
                    userId={student.userId}
                    studentName={student.fullName}
                    section="lessons"
                    onChanged={onChanged}
                    onPlan={onCreateBooking}
                  />
                </div>
              )}
            </div>
          )}

          {visitedTabs.has("packages") && student.userId && (
            <div className={tab === "packages" ? "space-y-6" : "hidden"}>
              <StudentLearningManager userId={student.userId} section="packages" onChanged={onChanged} />
              <StudentLearningManager userId={student.userId} section="payments" onChanged={onChanged} />
            </div>
          )}

          {visitedTabs.has("notes") && student.userId && (
            <div className={tab === "notes" ? "" : "hidden"}>
              <StudentLearningManager
                userId={student.userId}
                studentName={student.fullName}
                section="notes"
                onChanged={onChanged}
              />
            </div>
          )}

          {(["education", "packages", "notes"] as Tab[]).includes(tab) && !student.userId && (
            <NoAccount />
          )}
        </div>
      </div>

      {/* Password Reset Confirmation Dialog */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="alertdialog">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
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

            <div className="flex flex-col-reverse gap-2 pt-2 border-t border-border sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setResetModalOpen(false)}
                className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer sm:w-auto"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handlePasswordReset}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer sm:w-auto"
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
            toast.success(msg);
            onChanged?.();
          }}
        />
      )}

      {/* Record Past Lesson Modal */}
      {recordLessonModalOpen && (
        <RecordPastLessonModal
          student={student}
          onClose={() => setRecordLessonModalOpen(false)}
          onSuccess={(msg) => {
            toast.success(msg);
            setRecordLessonModalOpen(false);
            onChanged?.();
          }}
        />
      )}

      {/* Decrease Lesson Rights Modal */}
      {decreaseRightsModalOpen && (
        <DecreaseLessonRightsModal
          student={student}
          onClose={() => setDecreaseRightsModalOpen(false)}
          onSuccess={(msg) => {
            toast.success(msg);
            setDecreaseRightsModalOpen(false);
            onChanged?.();
          }}
        />
      )}

      {/* Reschedule Booking Modal ("Dersi Ertele") */}
      {rescheduleBooking && (
        <RescheduleBookingModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onSuccess={(patch) => {
            patchBooking(rescheduleBooking.id, patch);
            toast.success("Ders başarıyla ertelendi.");
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
  onOpenRecordPastLesson,
  onOpenDecreaseRights,
  onOpenPasswordReset,
  onOpenEditIdentity,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onOpenRecordPastLesson: () => void;
  onOpenDecreaseRights: () => void;
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Ad Soyad" value={val(student.fullName)} />
          <Info label="E-posta" value={val(student.email)} />
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
          <Info
            label="Aktif Paket"
            value={
              student.activePackage && (student.activePackage.lessonCount - student.activePackage.lessonsUsed) > 0
                ? student.activePackage.name
                : "Aktif Paket Bulunmuyor"
            }
          />
          <Info
            label="Kalan Ders"
            value={
              student.activePackage && (student.activePackage.lessonCount - student.activePackage.lessonsUsed) > 0
                ? `${student.activePackage.lessonCount - student.activePackage.lessonsUsed} ders`
                : "0 ders"
            }
          />
          <Info label="Sonraki Randevu" value={date(student.nextAppointment)} />
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onOpenRecordPastLesson}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors shadow-2xs"
        >
          <History className="size-4 text-primary" />
          Geçmiş Ders Gir
        </button>
        <button
          type="button"
          onClick={onOpenDecreaseRights}
          disabled={!student.activePackage || (student.activePackage.lessonCount - student.activePackage.lessonsUsed) <= 0}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 text-xs font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <MinusCircle className="size-4 text-rose-700" />
          Ders Hakkı Azalt
        </button>
        <button
          onClick={onCreateBooking}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors"
        >
          <CalendarPlus className="size-4" />
          Ders Planla
        </button>
        <a href={`mailto:${student.email}`} className={action}>
          <Mail className="size-4" />
          E-posta Gönder
        </a>
        <button
          onClick={onOpenPasswordReset}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer transition-colors"
        >
          <KeyRound className="size-4 text-amber-700" />
          Şifre Sıfırlama
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

/** Manual, admin-triggered appointment emails: MAIL-021/023/024/025. */
type ManualBookingEmail = "confirm" | "update" | "remind" | "cancel";

function Appointments({
  student,
  onCreateBooking,
  onOpenRecordPastLesson,
  onOpenDecreaseRights,
  onPatchBooking,
  onOpenReschedule,
  onDone,
}: {
  student: StudentProfile;
  onCreateBooking: () => void;
  onOpenRecordPastLesson: () => void;
  onOpenDecreaseRights: () => void;
  onPatchBooking: (bookingId: string, patch: Partial<BookingWithSlot> | null) => void;
  onOpenReschedule: (booking: BookingWithSlot) => void;
  onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sendingEmail, setSendingEmail] = useState("");
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());

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
        if (!r.alreadyCompleted) onPatchBooking(id, { status: "completed" });
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
      if (r.error) {
        setError(r.error);
      } else {
        onPatchBooking(id, { status: "completed" });
        onDone("Görüşme/randevu tamamlandı (Paket düşülmedi).");
      }
    }
    setBusy("");
  }

  async function cancelAppointment(id: string) {
    setBusy(id);
    setError("");
    const r = await updateAdminBookingStatus(id, "cancelled");
    if (r.error) {
      setError(r.error);
    } else {
      // Immediate, authoritative-once-confirmed local update: the booking
      // moves from "Yaklaşan Seanslar" to "Geçmiş Seanslar" on this render,
      // no refresh needed. See "DERS İPTAL UI STATE BUG".
      onPatchBooking(id, { status: "cancelled" });
      onDone("Randevu iptal edildi.");
    }
    setBusy("");
  }

  // MAIL-021/023/024/025: explicit, admin-triggered only -- appointment
  // creation, approval, reschedule and cancellation never send email on their
  // own (see src/lib/admin/bookings.ts). One click = one email: only the
  // clicked button disables for the duration of the request (covers
  // double-click), the sheet stays open, and the server-side idempotency claim
  // collapses network retries/replays inside the dedupe window while still
  // allowing a deliberate later "Tekrar Gönder".
  const EMAIL_LABELS: Record<ManualBookingEmail, { idle: string; again: string; done: string }> = {
    confirm: {
      idle: "Bilgilendirme E-postası Gönder",
      again: "Bilgilendirme E-postasını Tekrar Gönder",
      done: "Bilgilendirme e-postası gönderildi.",
    },
    update: {
      idle: "Tarih Değişikliği E-postası Gönder",
      again: "Tarih Değişikliği E-postasını Tekrar Gönder",
      done: "Tarih değişikliği e-postası gönderildi.",
    },
    remind: {
      idle: "Hatırlatma E-postası Gönder",
      again: "Hatırlatma E-postasını Tekrar Gönder",
      done: "Hatırlatma e-postası gönderildi.",
    },
    cancel: {
      idle: "İptal E-postası Gönder",
      again: "İptal E-postasını Tekrar Gönder",
      done: "İptal e-postası gönderildi.",
    },
  };

  async function sendManualEmail(id: string, action: ManualBookingEmail) {
    const key = id + action;
    if (sendingEmail === key) return;
    setSendingEmail(key);
    setError("");
    const r = await sendAdminBookingNotification(id, action);
    setSendingEmail("");
    if (!r.success) {
      setError(r.error || "Bilgilendirme e-postası gönderilemedi.");
      return;
    }
    setSentEmails((prev) => new Set(prev).add(key));
    onDone(EMAIL_LABELS[action].done);
  }

  function emailLabel(id: string, action: ManualBookingEmail) {
    const key = id + action;
    if (sendingEmail === key) return "Gönderiliyor…";
    return sentEmails.has(key) ? EMAIL_LABELS[action].again : EMAIL_LABELS[action].idle;
  }

  const upcoming = student.bookings.filter((b) => !["completed", "cancelled", "no_show"].includes(b.status));
  const past = student.bookings.filter((b) => ["completed", "cancelled", "no_show"].includes(b.status));

  return (
    <div className="space-y-5">
      {/* Top Header with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-ink">Ders & Randevu Yönetimi</h3>
          <p className="text-xs text-muted-foreground">
            Öğrencinin yaklaşan ve geçmiş ders seanslarını yönetin ve hızlı işlem yapın.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenRecordPastLesson}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors shadow-2xs"
            title="Geçmiş veya gelecek ders tanımla"
          >
            <History className="size-4 text-primary" />
            Manuel Ders Ekle
          </button>
          <button
            type="button"
            onClick={onOpenDecreaseRights}
            disabled={!hasActivePackage || remainingLessons <= 0}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 text-xs font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <MinusCircle className="size-4 text-rose-700" />
            Ders Hakkı Azalt
          </button>
          <button
            type="button"
            onClick={onCreateBooking}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors shadow-xs"
          >
            <CalendarPlus className="size-4" />
            Ders Planla
          </button>
        </div>
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
                    {/* Minimal status badge only -- package/extra-lesson
                        assignment lives in the Paket & Ödeme tab, not here. */}
                    {isExplicitLesson && !(hasActivePackage && remainingLessons > 0) && (
                      <span className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                        {hasActivePackage ? "Paket Bakiyesi: 0 Ders" : "Aktif Paket Yok"}
                      </span>
                    )}

                    {/* Main actions */}
                    {isExplicitLesson ? (
                      hasActivePackage && remainingLessons > 0 && (
                        <button
                          type="button"
                          disabled={busy === b.id}
                          onClick={() => void finish(b.id, true)}
                          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          Dersi Tamamla (Paketten 1 Ders Düş)
                        </button>
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
                      onClick={() => onOpenReschedule(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Clock className="size-3.5 text-primary" />
                      Dersi Ertele
                    </button>

                    <button
                      type="button"
                      disabled={busy === b.id}
                      onClick={() => void cancelAppointment(b.id)}
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      Dersi İptal Et
                    </button>

                    {(["confirm", "update", "remind"] as ManualBookingEmail[]).map((emailAction) => (
                      <button
                        key={emailAction}
                        type="button"
                        disabled={sendingEmail === b.id + emailAction}
                        onClick={() => void sendManualEmail(b.id, emailAction)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer disabled:opacity-50 transition-colors"
                        title="Ders/randevu oluşturma ve değişiklikler otomatik e-posta göndermez; bu butonlar dışında hiçbir işlem öğrenciye mail atmaz."
                      >
                        <Mail className="size-3.5 text-primary" />
                        {emailLabel(b.id, emailAction)}
                      </button>
                    ))}
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
                        rel="noopener noreferrer"
                        className="font-mono text-primary underline break-all flex items-center gap-1 hover:text-forest"
                      >
                        {b.live_meeting_url}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </div>
                    <a
                      href={b.live_meeting_url!}
                      target="_blank"
                      rel="noopener noreferrer"
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
                <div className="flex items-center gap-2">
                  {b.status === "cancelled" && (
                    <button
                      type="button"
                      disabled={sendingEmail === b.id + "cancel"}
                      onClick={() => void sendManualEmail(b.id, "cancel")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Mail className="size-3 text-primary" />
                      {emailLabel(b.id, "cancel")}
                    </button>
                  )}
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

            <div className="flex flex-col-reverse gap-2 pt-2 border-t border-border sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer sm:w-auto"
              >
                İptal
              </button>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest cursor-pointer shadow-xs sm:w-auto"
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

            <div className="flex flex-col gap-2 pt-2 border-t border-border sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={busy}
                onClick={() => { setStep("edit"); setAdminPassword(""); setError(""); }}
                className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer sm:w-auto"
              >
                &larr; Geri Dön
              </button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer sm:w-auto"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer shadow-xs sm:w-auto"
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

function RecordPastLessonModal({
  student,
  onClose,
  onSuccess,
}: {
  student: StudentProfile;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [lessonType, setLessonType] = useState<"past" | "future" | null>(null);
  const [lessonDate, setLessonDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lessonTime, setLessonTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [subject, setSubject] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonType) {
      setError("Lütfen ders türünü seçiniz (Geçmiş Ders veya Gelecek Ders).");
      return;
    }
    if (!lessonDate) {
      setError("Tarih seçilmelidir.");
      return;
    }

    const targetIso = new Date(`${lessonDate}T${lessonTime || "12:00"}:00`).toISOString();
    const targetTimestamp = new Date(targetIso).getTime();
    const nowTimestamp = Date.now();

    if (lessonType === "past") {
      if (targetTimestamp > nowTimestamp + 5 * 60_000) {
        setError("Geçmiş ders için gelecekteki bir tarih/saat seçilemez. Lütfen geçmiş bir tarih giriniz veya 'Gelecek Ders' seçeneğini kullanınız.");
        return;
      }
    } else {
      if (targetTimestamp < nowTimestamp - 15 * 60_000) {
        setError("Gelecek ders için geçmiş bir tarih/saat seçilemez. Lütfen ileri bir tarih giriniz veya 'Geçmiş Ders' seçeneğini kullanınız.");
        return;
      }
    }

    setBusy(true);
    setError("");

    if (lessonType === "past") {
      const hasActivePkg = Boolean(student.activePackage && (student.activePackage.lessonCount - student.activePackage.lessonsUsed) > 0);
      const remaining = hasActivePkg && student.activePackage ? Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed) : 0;

      const res = await recordCompletedLesson({
        studentId: student.userId || student.id,
        lessonDate: targetIso,
        durationMinutes,
        title: subject.trim() || "Tamamlanan Ders",
        subject: subject.trim() || (student.targetExam ? `${student.targetExam} Dersi` : "Birebir Ders"),
        teacherNote: teacherNote.trim() || null,
        packagePurchaseId: hasActivePkg && remaining > 0 ? (student.activePackage?.id || null) : null,
        idempotencyKey: `past-lesson-${student.id}-${Date.now()}`,
      });

      setBusy(false);
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess("Geçmiş ders başarıyla kaydedildi ve paketten 1 ders hakkı düşüldü.");
      }
    } else {
      const res = await upsertStudentLesson({
        studentId: student.userId || student.id,
        title: subject.trim() || "Planlanan Ders",
        subject: subject.trim() || (student.targetExam ? `${student.targetExam} Dersi` : "Birebir Ders"),
        lessonDate: targetIso,
        durationMinutes,
        liveMeetingUrl: meetingUrl.trim() || null,
        teacherNote: teacherNote.trim() || null,
        status: "scheduled",
      });

      setBusy(false);
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess("Gelecek ders başarıyla takvime planlandı. Ders tamamlandığında paketten 1 hak düşülecektir.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
              <History className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">Manuel Ders Tanımla</h3>
              <p className="text-xs text-muted-foreground">{student.fullName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-bold text-ink">
            Ders Türü <span className="text-rose-600">* (Zorunlu Seçim)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                lessonType === "past"
                  ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/30"
                  : "border-border bg-surface hover:bg-surface-muted/50"
              }`}
            >
              <input
                type="radio"
                name="lessonTypeModal"
                value="past"
                checked={lessonType === "past"}
                onChange={() => {
                  setLessonType("past");
                  setError("");
                }}
                className="mt-0.5 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <History className="size-3.5 text-emerald-700" />
                  <span>○ Geçmiş Ders</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Gerçekleşmiş bir ders sisteme işlenir ve paketten 1 ders hakkı düşülür.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                lessonType === "future"
                  ? "border-primary bg-forest/5 shadow-xs ring-1 ring-primary/30"
                  : "border-border bg-surface hover:bg-surface-muted/50"
              }`}
            >
              <input
                type="radio"
                name="lessonTypeModal"
                value="future"
                checked={lessonType === "future"}
                onChange={() => {
                  setLessonType("future");
                  setError("");
                }}
                className="mt-0.5 text-primary focus:ring-primary cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Video className="size-3.5 text-primary" />
                  <span>○ Gelecek Ders</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Gelecekteki ders takvime planlanır. Ders hakkı bu aşamada düşülmez; ders tamamlandığında düşülecek ve 1 saat sonra kalan hak bildirimi gönderilecektir.
                </div>
              </div>
            </label>
          </div>
        </div>

        {lessonType === null && (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-center text-xs text-amber-900">
            Devam etmek için lütfen yukarıdan <strong>Geçmiş Ders</strong> veya <strong>Gelecek Ders</strong> seçeneğini belirleyiniz.
          </div>
        )}

        {lessonType !== null && (
          <form onSubmit={handleSubmit} className="space-y-3.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-ink">
                Ders Tarihi {lessonType === "past" ? "(Geçmiş Tarih)" : "(Gelecek Tarih)"}
                <input
                  type="date"
                  required
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
                />
              </label>

              <label className="block text-xs font-semibold text-ink">
                Saat
                <input
                  type="time"
                  required
                  value={lessonTime}
                  onChange={(e) => setLessonTime(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-ink">
                Ders Süresi
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary cursor-pointer"
                >
                  <option value={30}>30 dakika</option>
                  <option value={45}>45 dakika</option>
                  <option value={60}>60 dakika (1 saat)</option>
                  <option value={90}>90 dakika (1.5 saat)</option>
                  <option value={120}>120 dakika (2 saat)</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-ink">
                Ders / Konu
                <input
                  type="text"
                  placeholder="Örn: SAT Math — Türev ve İntegral"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
                />
              </label>
            </div>

            {lessonType === "future" && (
              <label className="block text-xs font-semibold text-ink">
                Görüşme Bağlantısı <span className="font-normal text-muted-foreground">(İsteğe Bağlı)</span>
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
                />
              </label>
            )}

            <label className="block text-xs font-semibold text-ink">
              Eğitmen Notu <span className="font-normal text-muted-foreground">(İsteğe Bağlı)</span>
              <textarea
                placeholder="Ders notu..."
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-input bg-surface p-2.5 text-xs text-ink outline-none focus:border-primary"
              />
            </label>

            {lessonType === "past" && (
              student.activePackage && (student.activePackage.lessonCount - student.activePackage.lessonsUsed) > 0 ? (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-surface-muted/60 rounded-xl p-2.5">
                  <InfoIcon className="size-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>Öğrencinin aktif <strong>{student.activePackage.name}</strong> paketi ({student.activePackage.lessonCount - student.activePackage.lessonsUsed} ders kaldı) bulunmaktadır. Kaydedildiğinde paketten 1 ders hakkı düşülecektir.</span>
                </p>
              ) : (
                <p className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 rounded-xl p-2.5">
                  ℹ️ Öğrencinin aktif ders hakkı kalmamıştır. Ders bağımsız/ekstra geçmiş ders olarak kaydedilecektir.
                </p>
              )
            )}

            <div className="flex flex-col-reverse gap-2 pt-3 border-t border-border sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer sm:w-auto"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer shadow-xs transition-colors sm:w-auto"
              >
                {busy ? "Kaydediliyor..." : (lessonType === "past" ? "Geçmiş Dersi Kaydet" : "Gelecek Dersi Planla")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DecreaseLessonRightsModal({
  student,
  onClose,
  onSuccess,
}: {
  student: StudentProfile;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const currentRemaining = student.activePackage
    ? Math.max(0, student.activePackage.lessonCount - student.activePackage.lessonsUsed)
    : 0;

  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("Ders tamamlandı");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const newRemaining = Math.max(0, currentRemaining - amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student.activePackage?.id) {
      setError("Öğrencinin aktif bir paketi bulunmamaktadır.");
      return;
    }
    if (amount <= 0) {
      setError("Azaltılacak ders adedi en az 1 olmalıdır.");
      return;
    }
    if (amount > currentRemaining) {
      setError(`Kalan ders adedinden (${currentRemaining}) daha fazla hak azaltılamaz.`);
      return;
    }
    if (reason.trim().length < 3) {
      setError("Lütfen en az 3 karakterlik bir gerekçe belirtin.");
      return;
    }

    setBusy(true);
    setError("");

    const res = await adjustStudentPackageLessons({
      purchaseId: student.activePackage.id,
      lessonDelta: -amount,
      reason: reason.trim(),
    });

    setBusy(false);
    if (!res.success) {
      setError(res.error || "Ders hakkı azaltılamadı.");
    } else {
      onSuccess(`Ders hakkı ${amount} adet azaltıldı. Yeni kalan hak: ${res.newRemaining}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
              <MinusCircle className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">Ders Hakkı Azalt</h3>
              <p className="text-xs text-muted-foreground">{student.fullName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Status summary */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-muted/50 p-3 text-center">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Mevcut Hak</span>
              <strong className="text-sm font-bold text-ink">{currentRemaining}</strong>
            </div>
            <div className="border-x border-border">
              <span className="block text-[10px] uppercase font-semibold text-rose-700">Azaltılacak</span>
              <strong className="text-sm font-bold text-rose-700">-{amount}</strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Yeni Hak</span>
              <strong className="text-sm font-bold text-emerald-800">{newRemaining}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Azaltılacak Ders Adedi
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.max(1, currentRemaining)}
                required
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(currentRemaining, Number(e.target.value) || 1)))}
                className="min-h-10 flex-1 rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setAmount(1)}
                className="min-h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
              >
                -1 Ders
              </button>
            </div>
          </div>

          <label className="block text-xs font-semibold text-ink">
            Gerekçe / Neden
            <input
              type="text"
              required
              minLength={3}
              placeholder="Örn: Ders tamamlandı, Öğrenci talebi..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary"
            />
          </label>

          <p className="flex items-start gap-1.5 rounded-xl border border-border bg-surface-muted/60 p-2.5 text-[11px] text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>
              Bu işlem hesap sahibine e-posta göndermez. İşlemden sonra paket kartındaki
              {" "}<strong>Ders Hakkı Güncelleme E-postası Gönder</strong> butonuyla
              bilgilendirme yapabilirsiniz.
            </span>
          </p>

          <div className="flex flex-col-reverse gap-2 pt-3 border-t border-border sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer sm:w-auto"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={busy || currentRemaining <= 0}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50 cursor-pointer shadow-xs transition-colors sm:w-auto"
            >
              {busy ? "İşleniyor..." : "Ders Hakkını Azalt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * "Dersi Ertele" -- updates the existing booking's own time slot via the
 * canonical admin_update_booking_event RPC (no duplicate row created), see
 * "DERSİ ERTELE AKIŞI". Duration defaults to the lesson's current length.
 */
function RescheduleBookingModal({
  booking,
  onClose,
  onSuccess,
}: {
  booking: BookingWithSlot;
  onClose: () => void;
  onSuccess: (patch: Partial<BookingWithSlot>) => void;
}) {
  const currentStart = booking.availability_slots?.starts_at || null;
  const currentEnd = booking.availability_slots?.ends_at || null;
  const currentDurationMinutes = currentStart && currentEnd
    ? Math.max(15, Math.round((new Date(currentEnd).getTime() - new Date(currentStart).getTime()) / 60000))
    : 60;

  const [date, setDate] = useState(() => (currentStart ? new Date(currentStart) : new Date()).toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const d = currentStart ? new Date(currentStart) : new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(currentDurationMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [succeeded, setSucceeded] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setError("Tarih ve saat seçilmelidir.");
      return;
    }
    const newStart = new Date(`${date}T${time}:00`);
    if (Number.isNaN(newStart.getTime()) || newStart.getTime() < Date.now() - 5 * 60_000) {
      setError("Lütfen geçerli, geçmişte olmayan bir tarih/saat seçiniz.");
      return;
    }
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);

    setBusy(true);
    setError("");
    const res = await updateAdminBookingEvent({
      bookingId: booking.id,
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error || "Ders ertelenemedi.");
      return;
    }
    onSuccess({
      availability_slots: { id: booking.availability_slots?.id || "", starts_at: newStart.toISOString(), ends_at: newEnd.toISOString(), status: booking.availability_slots?.status || "booked" },
    });
    // Card updates instantly; keep the modal open one extra step so the admin
    // can optionally notify the student -- MAIL-023 is explicit/manual only,
    // never automatic (see "RANDEVU EMAIL'LERİ DE EXPLICIT/MANUEL OLMALI").
    setSucceeded(true);
  }

  async function handleSendUpdateEmail() {
    setEmailSending(true);
    setError("");
    const res = await sendAdminBookingNotification(booking.id, "update");
    setEmailSending(false);
    if (!res.success) {
      setError(res.error || "Tarih değişikliği e-postası gönderilemedi.");
      return;
    }
    setEmailSent(true);
  }

  if (succeeded) {
    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">Ders Başarıyla Ertelendi</h3>
              <p className="text-xs text-muted-foreground">Yeni tarih/saat kartta güncellendi.</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Öğrenciye tarih değişikliği bilgilendirmesi göndermek isterseniz aşağıdaki butonu kullanabilirsiniz. Bu e-posta otomatik gönderilmez.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer sm:w-auto"
            >
              Kapat
            </button>
            <button
              type="button"
              disabled={emailSending}
              onClick={() => void handleSendUpdateEmail()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer sm:w-auto"
            >
              <Mail className="size-3.5" />
              {emailSending
                ? "Gönderiliyor..."
                : emailSent
                ? "Tarih Değişikliği E-postasını Tekrar Gönder"
                : "Tarih Değişikliği E-postası Gönder"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-ink">Dersi Ertele</h3>
              <p className="text-xs text-muted-foreground">{booking.appointment_subject || booking.exam_code || "Birebir Seans"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink">
              Yeni Tarih
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              Yeni Saat
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-ink">
            Süre (dakika)
            <input
              type="number"
              min={15}
              max={240}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
              className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 border-t border-border sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer sm:w-auto disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer shadow-xs transition-colors sm:w-auto"
            >
              {busy ? "Erteleniyor..." : "Dersi Ertele"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
