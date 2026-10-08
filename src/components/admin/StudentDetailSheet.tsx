import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { formatTrPhoneDisplay, normalizeStudentPhone, trPhoneInputDigits, trPhoneWaDigits } from "@/lib/format/phone";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
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
  History,
  MinusCircle,
  Clock,
  Plus,
  Users,
  Settings,
  School,
  GraduationCap,
  BadgeCheck,
  ChevronDown,
  Phone,
  ArrowLeft,
} from "lucide-react";
import type { NormalizedSessionItem } from "@/components/admin/StudentLearningManager";
import { ADMIN_UI_FEATURES } from "@/config/admin-ui";
import { StudentGradeManagerModal } from "@/components/admin/StudentGradeManagerModal";
import { StudentExamManagerModal } from "@/components/admin/StudentExamManagerModal";
import { useToast } from "@/components/ui/toast";
import { completeStudentAppointment, recordCompletedLesson, upsertStudentLesson, adjustStudentPackageLessons } from "@/lib/admin/student-learning";
import { updateAdminBookingStatus, updateAdminBookingEvent, sendAdminBookingNotification, type BookingWithSlot } from "@/lib/admin/bookings";
import {
  sendStudentPasswordReset,
  adminUpdateStudentProfile,
  adminUpdateGuardianName,
  adminCreateStudentForGuardian,
  listGuardianLinkedStudents,
  listStudentGradeOptions,
  listStudentExamOptions,
  restoreAdminMember,
  type StudentGradeOption,
  type StudentExamOption,
  type GuardianLinkedStudent,
  type StudentProfile,
} from "@/lib/admin/students";
import { useAccount } from "@/lib/auth/account-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";
import { invalidateStudentData } from "@/lib/data/query-store";
import {
  DEFAULT_LESSON_TIMEZONE_LABEL,
  LESSON_TIMEZONES,
  lessonTimezoneForLabel,
  localLessonDateTimeToUtc,
  type LessonTimezoneLabel,
} from "@/lib/lessons/timezones";
import { ControlledLessonDate, ControlledLessonTime } from "@/components/admin/ControlledLessonDateTime";
import styles from "./student-detail.module.css";
import pages from "./admin-pages.module.css";
import { CloseIcon, GearIcon } from "@/components/admin/StudentRefDialogs";
import { AdminTrPhoneInput } from "@/components/admin/AdminTrPhoneInput";

const StudentLearningManager = dynamic(
  () => import("@/components/admin/StudentLearningManager").then((module) => module.StudentLearningManager),
  {
    loading: () => (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/80 bg-white text-xs text-muted-foreground shadow-2xs">
        Sekme içeriği hazırlanıyor…
      </div>
    ),
  }
);

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
  pageMode = false,
}: {
  student: StudentProfile | null;
  initialTab?: Tab;
  onClose: () => void;
  onCreateBooking: () => void;
  onChanged?: () => void;
  pageMode?: boolean;
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
  const [learningAction, setLearningAction] = useState<{ type: "add_lesson" | "add_package" | "add_note"; nonce: number } | null>(null);
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

  function requestLearningAction(type: "add_lesson" | "add_package" | "add_note", next: Tab) {
    handleTabChange(next);
    setLearningAction({ type, nonce: Date.now() });
  }

  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  useEffect(() => {
    if (!studentProp) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (decreaseRightsModalOpen) setDecreaseRightsModalOpen(false);
        else if (recordLessonModalOpen) setRecordLessonModalOpen(false);
        // Bilgileri Düzenle yerel <dialog>: Esc'yi kendi "cancel" olayı yönetir
        // (iç içe Sınıf/Sınav Yönetimi açıksa yalnız o kapanır).
        else if (editModalOpen) return;
        else if (resetModalOpen) setResetModalOpen(false);
        else if (rescheduleBooking) setRescheduleBooking(null);
        else if (!pageMode) onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const unlockBodyScroll = pageMode ? () => undefined : lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockBodyScroll();
    };
  }, [studentProp, pageMode, onClose, resetModalOpen, editModalOpen, decreaseRightsModalOpen, recordLessonModalOpen, rescheduleBooking]);

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

  // WhatsApp: öğrencinin kendi numarası, yoksa velinin. Doğrudan sohbet açılır
  // (https://wa.me/<rakamlar>); hazır mesaj (text parametresi) eklenmez.
  const waPhone = student.phone || student.guardianPhone;
  const waDigits = trPhoneWaDigits(waPhone);
  const waReady = /^\d{11,15}$/.test(waDigits);
  const waIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29z" /></svg>;
  const headerActions = (
    <div className={styles.actions}>
      {waReady ? (
        <a
          className={`${styles.button} ${styles.waButton}`}
          href={`https://wa.me/${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp: ${student.phone ? "öğrenci" : "veli"} ${formatTrPhoneDisplay(waPhone)}`}
          title={`${student.phone ? "Öğrenci" : "Veli"}: ${formatTrPhoneDisplay(waPhone)}`}
          data-wa=""
        >
          {waIcon}
          <span className={styles.waLabel}>WhatsApp</span>
        </a>
      ) : (
        <span className={styles.waTip} title="Telefon numarası eklenmemiş">
          <button type="button" className={`${styles.button} ${styles.waButton}`} disabled aria-label="WhatsApp: Telefon numarası eklenmemiş" data-wa="">
            {waIcon}
            <span className={styles.waLabel}>WhatsApp</span>
          </button>
        </span>
      )}
      <button type="button" onClick={() => { setErrorMessage(""); setEditModalOpen(true); }} className={`${styles.button} ${styles.primary}${student.archived ? ` ${styles.isLocked}` : ""}`} aria-disabled={student.archived || undefined} tabIndex={student.archived ? -1 : undefined} title={student.archived ? "Arşivdeki öğrencide işlem yapılamaz" : undefined}><Edit3 size={17} />Bilgileri Düzenle</button>
    </div>
  );

  const content = (
    <div className={`${pageMode ? styles.page : "fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"} ${styles.scope}`} role={pageMode ? undefined : "dialog"} aria-modal={pageMode ? undefined : "true"} aria-labelledby="student-detail-title">
      {/* Fixed backdrop - clicking backdrop does NOT accidentally close the modal */}
      {!pageMode && <div className="fixed inset-0 cursor-default bg-[#17201b]/40 animate-[student-modal-overlay-in_160ms_ease-out_both] motion-reduce:animate-none" />}

      <div className={`${styles.panel} ${pageMode ? styles.pagePanel : "animate-[student-modal-panel-in_190ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none motion-reduce:transform-none"}`}>
        <div className={styles.scroll}>
        <div className={styles.wrap}>
        {pageMode && (
          <div className={styles.topBar}>
            <Link href="/admin/ogrenciler" className={styles.backLink} aria-label="Öğrencilere Dön">
              <ArrowLeft size={17} />
              Öğrenciler
            </Link>
          </div>
        )}
        {student.archived && student.userId ? <ArchiveBanner student={student} onRestored={() => { invalidateStudentData(); onChanged?.(); }} /> : null}
        <header className={`${styles.card} ${styles.hero}`}>
          <div className={styles.heroBody}>
            {!pageMode && <button onClick={onClose} className={styles.close} aria-label="Kapat"><X size={18} /></button>}
            <div className={styles.who}>
              <div className={styles.whoText}>
                <div className={styles.nameRow}>
                  <h1 id="student-detail-title" className={styles.name}>{student.fullName}</h1>
                  <span className={`${styles.status}${student.archived ? ` ${styles.arc}` : ""}`}>{student.archived ? "Arşivde" : student.active ? "Aktif Öğrenci" : "Pasif"}</span>
                </div>
                <div className={styles.metadata} aria-label="Öğrenci bilgileri">
                  {student.school ? <span><School size={15} />{student.school}</span> : null}
                  {student.gradeLevel ? <span><GraduationCap size={15} />{student.gradeLevel}</span> : null}
                  {student.educationProgram ? <span><BookOpen size={15} />{student.educationProgram}</span> : null}
                  {student.guardianLastSignIn ? <span><Clock size={15} />Veli son giriş: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(student.guardianLastSignIn))}</span> : null}
                  {!student.school && !student.gradeLevel && !student.educationProgram && !student.guardianLastSignIn ? <span className={styles.metadataEmpty}>Akademik bilgiler henüz eklenmemiş.</span> : null}
                </div>
              </div>
            </div>
            {headerActions}
          </div>
          <nav role="tablist" aria-label="Öğrenci sekmeleri" className={styles.tabs}>
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`${styles.tab} ${tab === item.id ? styles.activeTab : ""}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* Arşivdeki öğrencinin kayıtları salt okunur (referans: is-locked). */}
        <div className={`${styles.body}${student.archived ? ` ${styles.archivedBody}` : ""}`} inert={student.archived || undefined}>
          {errorMessage && (
            <div role="alert" className={styles.error}>
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
                onAddLesson={() => requestLearningAction("add_lesson", "education")}
                onAddPackage={() => requestLearningAction("add_package", "packages")}
              />
            </div>
          )}

          {visitedTabs.has("education") && (
            <div className={tab === "education" ? "" : "hidden"}>
              {student.userId && (
                <StudentLearningManager
                  userId={student.userId}
                  studentName={student.fullName}
                  section="lessons"
                  onChanged={onChanged}
                  onPlan={onCreateBooking}
                  referenceMode={pageMode}
                  actionRequest={learningAction}
                  notifyEmail={student.email}
                  onAddPackage={() => requestLearningAction("add_package", "packages")}
                  renderSessionView={pageMode ? undefined : (lessonSessions) => (
                    <Appointments
                      student={student}
                      lessonSessions={lessonSessions}
                      onPatchBooking={patchBooking}
                      onOpenReschedule={(booking) => setRescheduleBooking(booking)}
                      onDone={(text) => {
                        invalidateStudentData();
                        toast.success(text);
                        onChanged?.();
                      }}
                    />
                  )}
                />
              )}
            </div>
          )}

          {visitedTabs.has("packages") && student.userId && (
            <div className={tab === "packages" ? "space-y-6" : "hidden"}>
              <StudentLearningManager userId={student.userId} section="packages" onChanged={onChanged} referenceMode={pageMode} actionRequest={learningAction} notifyEmail={student.email} />
              <StudentLearningManager userId={student.userId} section="payments" onChanged={onChanged} referenceMode={pageMode} />
            </div>
          )}

          {visitedTabs.has("notes") && student.userId && (
            <div className={tab === "notes" ? "" : "hidden"}>
              <StudentLearningManager
                userId={student.userId}
                studentName={student.fullName}
                section="notes"
                onChanged={onChanged}
                referenceMode={pageMode}
                actionRequest={learningAction}
              />
            </div>
          )}

          {(["education", "packages", "notes"] as Tab[]).includes(tab) && !student.userId && (
            <NoAccount />
          )}
        </div>
        </div>
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
    </div>
  );
  return pageMode ? content : createPortal(content, document.body);
}

function Overview({
  student,
  onAddLesson,
  onAddPackage,
}: {
  student: StudentProfile;
  onAddLesson: () => void;
  onAddPackage: () => void;
}) {
  const val = (input: string | null | undefined) => input?.trim() || "—";
  const packageTotal = student.activePackage?.lessonCount ?? 0;
  const packageUsed = student.activePackage ? Math.min(packageTotal, Math.max(0, student.activePackage.lessonsUsed)) : 0;
  const packageRemaining = Math.max(0, packageTotal - packageUsed);

  return (
    <div className={`${styles.cols} ${styles.overviewCols}`}>
      <div className={`${styles.stack} ${styles.generalLeft}`}>
        <section className={`${styles.card} ${styles.cardPad}`}>
          <h2 className={styles.sectionTitle}>Akademik Profil</h2>
          <div className={styles.academic}>
            <AcademicCell label="Okul" value={val(student.school)} icon={<School size={20} />} />
            <AcademicCell label="Sınıf" value={val(student.gradeLevel)} icon={<GraduationCap size={20} />} />
            <AcademicCell label="Eğitim Programı" value={val(student.educationProgram)} icon={<BookOpen size={20} />} />
            <ExamInfo exams={student.examsTaken} />
          </div>
        </section>

        <section className={`${styles.card} ${styles.cardPad}`}>
          <h2 className={styles.sectionTitle}>Hesap Bilgileri</h2>
          {student.guardianUserId ? <AccountGuardian student={student} /> : null}
          <div className={styles.child}>
            <span className={styles.childName}>{student.fullName}</span>
            <span className={`${styles.label} ${styles.personTag}`}>Öğrenci</span>
          </div>
        </section>

      </div>

      <aside className={`${styles.stack} ${styles.generalRight}`}>
        <section className={styles.package}>
          <div className={styles.packageHead}>
            <div className={styles.packageHeadText}><span className={styles.label}>Aktif Paket</span><span className={styles.packageTitle}>{student.activePackage?.name || "Aktif paket yok"}</span></div>
            <Package size={22} color="#B9C6BC" />
          </div>
          {student.activePackage ? (
            <>
              <div className={styles.big}><b>{packageRemaining}</b><span>/ {packageTotal} ders kaldı</span></div>
              {/* Tek parça çizgi: dolu kısım kalan ders oranı (10 dersten 6 kaldı → %60). */}
              <div className={styles.progress} role="progressbar" aria-label="Kalan ders" aria-valuemin={0} aria-valuemax={packageTotal} aria-valuenow={packageRemaining} aria-valuetext={`${packageTotal} dersten ${packageRemaining} ders kaldı`}><i style={{ width: `${packageTotal ? (packageRemaining / packageTotal) * 100 : 0}%` }} /></div>
              <small>{packageUsed} ders tamamlandı</small>
            </>
          ) : (
            <>
              <p className={styles.peText}>Son paket tamamlandı. Yeni ders kaydı eklemek için önce bir paket tanımlayın.</p>
              <button type="button" onClick={onAddPackage} className={`${styles.button} ${styles.btnGold}`}><Plus size={16} />Yeni Paket Tanımla</button>
            </>
          )}
          {ADMIN_UI_FEATURES.showNextAppointmentSummary && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">Sonraki Randevu</span>
              <p className="mt-1 text-xs font-semibold text-white/85">{date(student.nextAppointment)}</p>
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.sideCard}`}>
          <h2 className={styles.sectionTitle}>Hızlı İşlemler</h2>
            <button type="button" onClick={onAddLesson} className={styles.rowButton}><History size={18} />Ders Kaydı Ekle <span className={styles.rowArrow}>›</span></button>
            <button type="button" onClick={onAddPackage} className={styles.rowButton}><Package size={18} />Yeni Paket Tanımla <span className={styles.rowArrow}>›</span></button>
        </section>
      </aside>
    </div>
  );
}

function AccountGuardian({ student }: { student: StudentProfile }) {
  const [expanded, setExpanded] = useState(false);
  const guardianName = student.guardianName || "Belirtilmemiş";
  return (
    <div className={styles.guardianAccount}>
      <button type="button" className={styles.guardianToggle} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <span className={styles.value}>{guardianName}</span>
        <span className={styles.guardianRight}><span className={styles.label}>Veli</span><ChevronDown size={18} className={expanded ? styles.chevronOpen : ""} /></span>
      </button>
      {expanded && (
        <div className={styles.guardianDetails}>
          <span><Users size={16} /><b>{guardianName}</b></span>
          <span><Phone size={16} /><b>{formatTrPhoneDisplay(student.guardianPhone) || "Belirtilmemiş"}</b></span>
          <span><Mail size={16} /><b>{student.guardianEmail || "Belirtilmemiş"}</b></span>
        </div>
      )}
    </div>
  );
}

function GuardianStudentsSection({
  guardianUserId,
  guardianName,
  guardianEmail,
  onChanged,
}: {
  guardianUserId: string;
  guardianName: string;
  guardianEmail: string | null;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [students, setStudents] = useState<GuardianLinkedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create"; student: null } | { mode: "edit"; student: GuardianLinkedStudent } | null>(null);
  const [fullName, setFullName] = useState("");
  const [relationshipRole, setRelationshipRole] = useState<GuardianLinkedStudent["relationshipRole"]>("parent");
  const [gradeLevel, setGradeLevel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await listGuardianLinkedStudents(guardianUserId);
    setStudents(result.data);
    setError(result.error || "");
    setLoading(false);
  }, [guardianUserId]);

  useEffect(() => {
    let active = true;
    void listGuardianLinkedStudents(guardianUserId).then((result) => {
      if (!active) return;
      setStudents(result.data);
      setError(result.error || "");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [guardianUserId]);

  const openCreate = () => {
    setFullName("");
    setRelationshipRole("parent");
    setGradeLevel("");
    setError("");
    setModal({ mode: "create", student: null });
  };
  const openEdit = (student: GuardianLinkedStudent) => {
    setFullName(student.fullName);
    setRelationshipRole(student.relationshipRole);
    setGradeLevel(student.gradeLevel || "");
    setError("");
    setModal({ mode: "edit", student });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = fullName.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 100) {
      setError("Ad Soyad 2–100 karakter arasında olmalıdır.");
      return;
    }
    setBusy(true);
    const result = modal?.mode === "edit"
      ? await adminUpdateStudentProfile(modal.student.id, {
          fullName: cleanName,
          gradeLevel: gradeLevel || null,
        })
      : await adminCreateStudentForGuardian(guardianUserId, cleanName, relationshipRole, gradeLevel || null);
    setBusy(false);
    if (!result.success) {
      setError(result.error || "İşlem tamamlanamadı.");
      return;
    }
    setModal(null);
    await load();
    invalidateStudentData();
    onChanged?.();
    toast.success(modal?.mode === "edit" ? "Öğrenci adı güncellendi." : "Öğrenci veli hesabına eklendi.");
  };

  const roleLabel = (role: GuardianLinkedStudent["relationshipRole"]) => ({
    self: "Kendisi",
    parent: "Veli",
    guardian: "Yasal Vasi",
    other: "Diğer",
  }[role]);

  return (
    <section className={`${styles.card} ${styles.cardPad}`}>
      <div className={styles.guardianHead}>
        <div>
          <h2 className={styles.sectionTitle}>Veli Bilgileri</h2>
          <span className={styles.sub}>Bu veli hesabına bağlı öğrenciler</span>
        </div>
        <button type="button" onClick={openCreate} className={`${styles.button} ${styles.dashed}`}>
          <Plus className="size-3.5" /> Öğrenci Ekle
        </button>
      </div>
      <div className={styles.person}>
        <div className={styles.personPic}>{studentInitials(guardianName)}</div>
        <div><div className={styles.value}>{guardianName}</div>{guardianEmail && <div className={styles.sub}>{guardianEmail}</div>}</div>
        <span className={`${styles.label} ${styles.personTag}`}>Veli</span>
      </div>
      <div>
        <div className="sr-only">
          <Users />
          <h3>Öğrenci Bilgileri</h3>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Öğrenciler yükleniyor…</p>
        ) : students.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white p-3 text-xs text-muted-foreground">Bu veliye bağlı öğrenci bulunmuyor.</p>
        ) : (
          <div className={styles.children}>
            {students.map((linkedStudent) => (
              <div key={linkedStudent.id} className={styles.child}>
                  <div className={styles.childPic}>{studentInitials(linkedStudent.fullName)}</div>
                  <div><div className={styles.childName}>{linkedStudent.fullName}</div><div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{roleLabel(linkedStudent.relationshipRole)}</span>
                      {linkedStudent.isPrimary && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Birincil</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${linkedStudent.active ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{linkedStudent.active ? "Aktif" : "Pasif"}</span>
                    </div></div>
                  <button type="button" onClick={() => openEdit(linkedStudent)} className={styles.childEdit}>Düzenle</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="guardian-student-modal-title">
          <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="guardian-student-modal-title" className="font-heading text-base font-bold text-ink">{modal.mode === "create" ? "Öğrenci Ekle" : "Öğrenciyi Düzenle"}</h3>
                <p className="text-xs text-muted-foreground">Veli: {guardianName}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} aria-label="Kapat" className="rounded-lg border border-border p-1.5"><X className="size-4" /></button>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
            <label className="block text-xs font-semibold text-ink">Ad Soyad
              <input required minLength={2} maxLength={100} autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input px-3 text-sm outline-none focus:border-primary" />
            </label>
            <StudentGradeField value={gradeLevel} onChange={setGradeLevel} />
            {modal.mode === "create" && (
              <label className="block text-xs font-semibold text-ink">İlişki
                <select value={relationshipRole} onChange={(event) => setRelationshipRole(event.target.value as GuardianLinkedStudent["relationshipRole"])} className="mt-1 min-h-11 w-full rounded-xl border border-input px-3 text-sm outline-none focus:border-primary">
                  <option value="parent">Veli</option><option value="guardian">Yasal Vasi</option><option value="other">Diğer</option><option value="self">Kendisi</option>
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button type="button" disabled={busy} onClick={() => setModal(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">İptal</button>
              <button disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function StudentGradeField({ value, onChange, reference = false }: { value: string; onChange: (value: string) => void; reference?: boolean }) {
  const [options, setOptions] = useState<StudentGradeOption[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadOptions = useCallback(async () => {
    const result = await listStudentGradeOptions();
    setOptions(result.data);
    setLoadError(result.error || "");
  }, []);

  useEffect(() => {
    let active = true;
    void listStudentGradeOptions().then((result) => {
      if (!active) return;
      setOptions(result.data);
      setLoadError(result.error || "");
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedIsListed = options.some((option) => option.label === value);
  const optionList = (
    <>
      <option value="">Sınıf seçin</option>
      {value && !selectedIsListed && <option value={value}>{value} (mevcut)</option>}
      {options.filter((option) => option.active || option.label === value).map((option) => (
        <option key={option.id} value={option.label}>{option.label}{option.active ? "" : " (pasif)"}</option>
      ))}
    </>
  );
  const manager = managerOpen && <StudentGradeManagerModal items={options} onClose={() => setManagerOpen(false)} onChanged={loadOptions} />;

  // Referans #edit-dialog "Sınıf" alanı: .m-row içinde seçim + .m-gear.
  if (reference) {
    return (
      <div className="m-field">
        <label htmlFor="f-sinif" className="m-lab">Sınıf</label>
        <div className="m-row">
          <select id="f-sinif" className="m-input" value={value} onChange={(event) => onChange(event.target.value)}>{optionList}</select>
          <button type="button" className="m-gear" title="Sınıfları yönet" aria-label="Sınıf seçeneklerini yönet" onClick={() => setManagerOpen(true)}><GearIcon /></button>
        </div>
        {loadError && <span role="alert" className="m-hint" style={{ color: "#9A3324" }}>{loadError}</span>}
        {manager}
      </div>
    );
  }

  return (
    <>
      <label className="block text-xs font-semibold text-ink">Sınıf
        <div className="mt-1 flex gap-2">
          <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-[#D9D6CC] bg-white px-3.5 text-sm text-[#1C231E] outline-none focus-visible:ring-2 focus-visible:ring-[#C0902F]">
            {optionList}
          </select>
          <button type="button" title="Sınıfları yönet" aria-label="Sınıf seçeneklerini yönet" onClick={() => setManagerOpen(true)} className="flex size-[46px] shrink-0 items-center justify-center rounded-xl border border-[#D9D6CC] bg-white hover:bg-[#F7F6F1]">
            <Settings className="size-4" />
          </button>
        </div>
        {loadError && <span className="mt-1 block text-[11px] font-normal text-red-700">{loadError}</span>}
      </label>
      {manager}
    </>
  );
}

// Referans #edit-dialog "Aldığı Sınavlar": seçim + Ekle + .m-gear; eklenen
// sınavlar .m-chip etiketleri olarak listelenir.
function StudentExamField({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [options, setOptions] = useState<StudentExamOption[]>([]);
  const [selection, setSelection] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadOptions = useCallback(async () => {
    const result = await listStudentExamOptions();
    setOptions(result.data);
    setLoadError(result.error || "");
  }, []);

  useEffect(() => {
    let active = true;
    void listStudentExamOptions().then((result) => {
      if (!active) return;
      setOptions(result.data);
      setLoadError(result.error || "");
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedKeys = new Set(value.map((item) => item.trim().toLocaleLowerCase("tr-TR")));
  const selectable = options.filter((option) => option.active && !selectedKeys.has(option.label.trim().toLocaleLowerCase("tr-TR")));

  const addSelection = () => {
    if (!selection) return;
    const option = options.find((item) => item.id === selection && item.active);
    if (!option || selectedKeys.has(option.label.trim().toLocaleLowerCase("tr-TR"))) return;
    onChange([...value, option.label]);
    setSelection("");
  };

  return (
    <div className="m-field">
      <label htmlFor="f-sinav" className="m-lab">Aldığı Sınavlar</label>
      <div className="m-row">
        <select id="f-sinav" className="m-input" value={selection} onChange={(event) => setSelection(event.target.value)}>
          <option value="">Sınav seçin</option>
          {selectable.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <button type="button" className="m-add" data-guard-pick disabled={!selection} onClick={addSelection}>Ekle</button>
        <button type="button" className="m-gear" title="Sınavları yönet" aria-label="Sınav listesini yönet" onClick={() => setManagerOpen(true)}><GearIcon /></button>
      </div>
      {loadError && <span role="alert" className="m-hint" style={{ color: "#9A3324" }}>{loadError}</span>}
      {value.length === 0 ? (
        <span className="m-hint">Henüz sınav eklenmedi. Eklenen sınavlar burada etiket olarak görünür.</span>
      ) : (
        <div data-guard-val style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {value.map((exam, index) => (
            <span key={`${exam}-${index}`} className="m-chip">
              {exam}
              <button type="button" className="m-chipx" data-guard-pick aria-label={`${exam} sınavını kaldır`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      {managerOpen && <StudentExamManagerModal items={options} onClose={() => setManagerOpen(false)} onChanged={loadOptions} />}
    </div>
  );
}

/** Manual, admin-triggered appointment emails: MAIL-021/023/024/025. */
type ManualBookingEmail = "confirm" | "update" | "remind" | "cancel";

function Appointments({
  student,
  lessonSessions,
  onPatchBooking,
  onOpenReschedule,
  onDone,
}: {
  student: StudentProfile;
  lessonSessions: NormalizedSessionItem[];
  onPatchBooking: (bookingId: string, patch: Partial<BookingWithSlot> | null) => void;
  onOpenReschedule: (booking: BookingWithSlot) => void;
  onDone: (text: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sendingEmail, setSendingEmail] = useState("");
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [sendOnMutation, setSendOnMutation] = useState<Record<string, boolean>>({});

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
            ? "Ders tamamlandı, 1 ders paketten düşüldü ve geçmişe işlendi. Raporu Dersler & Takvim kartından hazırlayabilirsiniz."
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
    const r = await updateAdminBookingStatus(id, "cancelled", undefined, Boolean(sendOnMutation[id]));
    if (r.error) {
      setError(r.error);
    } else {
      // Immediate, authoritative-once-confirmed local update: the booking
      // moves from "Yaklaşan Seanslar" to "Geçmiş Seanslar" on this render,
      // no refresh needed. See "DERS İPTAL UI STATE BUG".
      onPatchBooking(id, { status: "cancelled" });
      onDone(`Randevu iptal edildi${r.emailSent ? " ve iptal e-postası gönderildi" : ""}.`);
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

  const linkedBookingIds = new Set(
    lessonSessions
      .filter((session) => session.type === "lesson")
      .map((session) => session.source.booking_id)
      .filter((bookingId): bookingId is string => Boolean(bookingId))
  );
  const standaloneBookings = student.bookings.filter((booking) => !linkedBookingIds.has(booking.id));
  const upcomingBookings = standaloneBookings
    .filter((b) => !["completed", "cancelled", "no_show"].includes(b.status))
    .sort((a, b) => (a.availability_slots?.starts_at || a.created_at).localeCompare(b.availability_slots?.starts_at || b.created_at));
  const pastBookings = standaloneBookings
    .filter((b) => ["completed", "cancelled", "no_show"].includes(b.status))
    .sort((a, b) => (b.availability_slots?.starts_at || b.created_at).localeCompare(a.availability_slots?.starts_at || a.created_at));

  const normalizeBooking = (booking: BookingWithSlot, group: "upcoming" | "past"): NormalizedSessionItem => {
    const startsAt = booking.availability_slots?.starts_at || booking.created_at;
    const endsAt = booking.availability_slots?.ends_at;
    const duration = endsAt ? Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000)) : null;
    return {
      type: "booking",
      group,
      id: booking.id,
      title: booking.appointment_subject || booking.exam_code || booking.custom_exam || "Birebir Randevu",
      subject: booking.exam_code || booking.custom_exam || booking.appointment_subject || "Randevu",
      date: startsAt,
      duration,
      status: booking.status,
      source: booking,
      card: null,
    };
  };
  const upcomingSessions = [
    ...lessonSessions.filter((session) => session.group === "upcoming"),
    ...upcomingBookings.map((booking) => normalizeBooking(booking, "upcoming")),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const pastSessions = [
    ...lessonSessions.filter((session) => session.group === "past"),
    ...pastBookings.map((booking) => normalizeBooking(booking, "past")),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      {/* Top Header with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-ink">Ders Yönetimi</h3>
          <p className="text-xs text-muted-foreground">
            Yapılan dersleri kronolojik olarak görüntüleyin ve yönetin.
          </p>
        </div>
        <p className="rounded-xl bg-primary/5 px-3 py-2 text-[11px] font-medium text-primary">Ders ve randevu aksiyonları kayıt türüne göre korunur.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reversible: future data stays loaded but is hidden in this workflow. */}
      {ADMIN_UI_FEATURES.showUpcomingSessions && (
        <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Yaklaşan Seanslar ({upcomingSessions.length})
        </h4>
        {upcomingSessions.length > 0 ? (
          upcomingSessions.map((session) => {
            if (session.type === "lesson") {
              return <div key={`lesson-${session.id}`}>{session.card}</div>;
            }
            const b = session.source;
            const hasMeetingLink = Boolean(b.live_meeting_url);
            const isExplicitLesson = b.event_type === "lesson" || (b.appointment_subject && (b.appointment_subject.startsWith("[Ders]") || b.appointment_subject.toLowerCase().includes("ders")));

            return (
              <div key={b.id} className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-3 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-ink">
                        {b.appointment_subject || b.exam_code || b.custom_exam || "Birebir Seans"}
                      </strong>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Randevu
                      </span>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {b.status === "confirmed" ? "Onaylandı" : b.status === "pending" ? "Bekliyor" : b.status}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{session.subject}</p>
                    <p className="mt-1 text-muted-foreground">
                      {date(b.availability_slots?.starts_at || b.created_at)}
                      {b.availability_slots?.ends_at ? ` — ${new Date(b.availability_slots.ends_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      {session.duration ? ` · ${session.duration} dk` : ""}
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

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-surface-muted/60 p-2.5 text-[11px] leading-relaxed text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(sendOnMutation[b.id])}
                    onChange={(event) => setSendOnMutation((current) => ({ ...current, [b.id]: event.target.checked }))}
                    className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span><strong>İptal işleminde e-posta gönder</strong><br />Yalnızca ders iptal edilirse iptal bilgisi gönderilir. Ders tamamlanınca otomatik e-posta gönderilmez.</span>
                </label>

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
            Yaklaşan planlanmış seans bulunmuyor.
          </div>
        )}
        </div>
      )}

      {/* Completed lesson history */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Yapılan Dersler ({pastSessions.length})
        </h4>
        {pastSessions.length > 0 ? (
          pastSessions.map((session) => {
            if (session.type === "lesson") {
              return <div key={`lesson-${session.id}`}>{session.card}</div>;
            }
            const b = session.source;
            return (
            <div key={b.id} className="rounded-2xl border border-border bg-surface p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-ink">
                      {b.appointment_subject || b.exam_code || b.custom_exam || "Birebir Seans"}
                    </strong>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Randevu
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{session.subject}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {date(b.availability_slots?.starts_at || b.created_at)}
                    {session.duration ? ` · ${session.duration} dk` : ""}
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
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-surface-muted/30">
            Henüz yapılan ders kaydı bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

const ARC_AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const ARC_GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

// Referans #arc-banner: arşivdeki öğrencinin detayı salt okunur; şerit arşiv
// tarihini, nedeni ve kanonik geri alma (admin_restore_member) düğmesini taşır.
function ArchiveBanner({ student, onRestored }: { student: StudentProfile; onRestored: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  let info = "";
  if (student.archivedAt) {
    const d = new Date(student.archivedAt);
    info = `${String(d.getDate()).padStart(2, "0")} ${ARC_AYLAR[d.getMonth()]} ${d.getFullYear()} ${ARC_GUNLER[d.getDay()]} tarihinde arşive taşındı`;
  }
  if (student.archiveReason) info += `${info ? " · " : ""}Neden: ${student.archiveReason}${student.archiveNote ? ` (${student.archiveNote})` : ""}`;
  const restore = async () => {
    if (busy || !student.userId) return;
    setBusy(true);
    const result = await restoreAdminMember(student.userId);
    setBusy(false);
    if (!result.success) { toast.error(result.error || "Öğrenci arşivden çıkarılamadı."); return; }
    toast.success(`${student.fullName} aktif öğrencilere geri alındı`);
    onRestored();
  };
  return (
    <div className={styles.arcBanner} id="arc-banner" role="status">
      <span className={styles.abIco}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></svg></span>
      <span className={styles.abText}><b>Bu öğrenci arşivde.</b> <span data-ab-info="">{info}</span><span className={styles.abSub}>Giriş erişimi kapalı, e-posta bildirimleri durduruldu. Kayıtlar salt okunur.</span></span>
      <button className={styles.button} type="button" data-ab-restore="" disabled={busy} onClick={() => void restore()}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>{busy ? "Geri alınıyor…" : "Arşivden çıkar"}</button>
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

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoCell}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

function AcademicCell({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className={styles.academicCell}>
      {icon}<span className={styles.label}>{label}</span><span className={styles.value}>{value}</span>
    </div>
  );
}

function ExamInfo({ exams }: { exams: string[] }) {
  const sortedExams = [...exams].sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));

  return (
    <div className={styles.academicCell}>
      <BadgeCheck size={20} />
      <span className={styles.label}>Aldığı Sınavlar</span>
      {sortedExams.length ? (
        <div className="flex flex-wrap gap-1.5">
          {sortedExams.map((exam, index) => <span key={`${exam}-${index}`} className="rounded-md bg-[#e4ece5] px-2 py-0.5 text-xs font-semibold text-[#2b4234]">{exam}</span>)}
        </div>
  ) : <span className={styles.value}>—</span>}
    </div>
  );
}

function studentInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR") || "ÖG";
}

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
    educationProgram: student.educationProgram || "",
    examsTaken: student.examsTaken,
    gradeLevel: student.gradeLevel || "",
    guardianName: student.guardianName || "",
    phone: trPhoneInputDigits(student.phone),
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [step, setStep] = useState<"edit" | "reauth">("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError("Ad Soyad alanı zorunludur.");
      return;
    }
    if (normalizeStudentPhone(form.phone) === undefined) {
      setError("Geçerli bir telefon numarası girin.");
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
      // Telefon yalnız gerçekten değiştiyse gönderilir; boş alan kaydı null yapar.
      const nextPhone = normalizeStudentPhone(form.phone) ?? null;
      const phoneChanged = nextPhone !== (normalizeStudentPhone(student.phone) ?? null);
      const res = await adminUpdateStudentProfile(targetId, {
        fullName: form.fullName,
        school: form.school || null,
        educationProgram: form.educationProgram || null,
        examsTaken: form.examsTaken,
        gradeLevel: form.gradeLevel || null,
        preferredLanguage: student.preferredLanguage,
        active: student.active,
        ...(phoneChanged ? { phone: nextPhone } : {}),
      });

      if (!res.success) {
        setBusy(false);
        setError(res.error || "Öğrenci bilgileri güncellenemedi.");
      } else {
        if (student.guardianUserId && form.guardianName.trim() !== (student.guardianName || "").trim()) {
          const guardianResult = await adminUpdateGuardianName(student.guardianUserId, form.guardianName);
          if (!guardianResult.success) {
            setBusy(false);
            setError(guardianResult.error || "Veli adı güncellenemedi.");
            return;
          }
        }
        setBusy(false);
        onSuccess("Öğrenci bilgileri başarıyla güncellendi.");
        onClose();
      }
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "İşlem sırasında bir hata oluştu.");
    }
  };

  const close = () => { if (!busy) onClose(); };
  const back = () => { setStep("edit"); setAdminPassword(""); setError(""); };

  // Referans #edit-dialog (oriens-admin_6.html). İkinci adım (yönetici şifre
  // doğrulaması) aynı pencerede, referansın .m-info / .m-field yapısıyla açılır.
  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <dialog
        ref={dialogRef}
        className="edit"
        id="edit-dialog"
        onCancel={(event) => {
          event.preventDefault();
          // Esc iç içe Sınıf/Sınav Yönetimi penceresine aittir; ana pencere açık kalır.
          if (event.target !== event.currentTarget || event.currentTarget.querySelector("dialog[open]")) return;
          close();
        }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <form className="m-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={step === "edit" ? handleNextStep : handleConfirmUpdate}>
          <div className="m-head">
            <div className="m-hicon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10271B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><h2 id="edit-title" className="m-htitle">Bilgileri Düzenle</h2></div>
            <button type="button" className="m-close" aria-label="Kapat" data-close onClick={close}><CloseIcon /></button>
          </div>
          <div className="m-body">
            {error && <p role="alert" className="m-warn" style={{ margin: "12px 0 0" }}>{error}</p>}
            {step === "edit" ? (
              <>
                <section className="m-sec">
                  <div className="m-sechead"><span className="m-secbadge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></svg></span><h3 className="m-sectitle">Öğrenci Bilgileri</h3><span className="m-secline" /></div>
                  <div className="m-grid">
                    <div className="m-field"><label htmlFor="f-ad" className="m-lab">Ad Soyad <span className="m-req">*</span></label><input id="f-ad" className="m-input" required type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                    <div className="m-field"><label htmlFor="f-okul" className="m-lab">Okul / Kurum</label><input id="f-okul" className="m-input" type="text" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} /></div>
                    <StudentGradeField reference value={form.gradeLevel} onChange={(gradeLevel) => setForm({ ...form, gradeLevel })} />
                    <div className="m-field"><label htmlFor="f-prog" className="m-lab">Eğitim Programı</label><input id="f-prog" className="m-input" type="text" value={form.educationProgram} onChange={(e) => setForm({ ...form, educationProgram: e.target.value })} /></div>
                    <div className="m-field" style={{ gridColumn: "1/-1" }}><label htmlFor="f-tel" className="m-lab">Telefon Numarası</label><AdminTrPhoneInput id="f-tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /></div>
                  </div>
                  <StudentExamField value={form.examsTaken} onChange={(examsTaken) => setForm({ ...form, examsTaken })} />
                </section>
                <section className="m-sec">
                  <div className="m-sechead"><span className="m-secbadge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9" /></svg></span><h3 className="m-sectitle">Veli Bilgileri</h3><span className="m-secline" /></div>
                  <div className="m-field"><label htmlFor="f-veli" className="m-lab">Veli Ad Soyad{student.guardianUserId ? <> <span className="m-req">*</span></> : null}</label><input id="f-veli" className="m-input" required={Boolean(student.guardianUserId)} disabled={!student.guardianUserId} type="text" value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} /></div>
                  <div className="m-vcard">Hesap e-postası: <b style={{ color: "#1C231E", fontWeight: 600, overflowWrap: "anywhere" }}>{student.guardianEmail || "Belirtilmemiş"}</b></div>
                </section>
                <div className="m-note"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A57622" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg><span>Kimlik değişiklikleri denetim kaydına yazılır ve yönetici şifre doğrulaması gerektirir.</span></div>
              </>
            ) : (
              <section className="m-sec">
                <div className="m-info">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A57622" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <span><b>Yönetici Şifre Doğrulaması</b><br />Öğrenci kimlik bilgilerini güncellemek hassas bir işlemdir. Devam etmek için aktif yönetici hesabınızın ({adminEmail}) şifresini girin.</span>
                </div>
                <div className="m-field"><label htmlFor="f-admin-pw" className="m-lab">Yönetici Şifreniz <span className="m-req">*</span></label><input id="f-admin-pw" className="m-input" required autoFocus type="password" autoComplete="current-password" placeholder="••••••••" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
              </section>
            )}
          </div>
          <div className="m-foot" data-foot>
            {step === "reauth" && <button type="button" className="m-cancel" disabled={busy} onClick={back} style={{ marginRight: "auto" }}>Geri Dön</button>}
            <button type="button" className="m-cancel" data-close disabled={busy} onClick={close}>İptal</button>
            {step === "edit" ? (
              <button type="submit" className="m-save">Devam Et <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
            ) : (
              <button type="submit" className="m-save" disabled={busy}>{busy ? "Doğrulanıyor ve Kaydediliyor..." : "Doğrula ve Güncelle"}</button>
            )}
          </div>
        </form>
      </dialog>
    </div>
  );
}

// Yerel gün anahtarı (YYYY-MM-DD); toISOString UTC günü verdiği için kullanılmaz.
const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  const [lessonDate, setLessonDate] = useState(() => localDayKey(new Date()));
  const [lessonTime, setLessonTime] = useState("10:00");
  const [timezoneLabel, setTimezoneLabel] = useState<LessonTimezoneLabel>(DEFAULT_LESSON_TIMEZONE_LABEL);
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

    const timezone = lessonTimezoneForLabel(timezoneLabel);
    let targetIso: string;
    try {
      targetIso = localLessonDateTimeToUtc(`${lessonDate}T${lessonTime || "12:00"}`, timezone.timeZone);
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : "Ders saati dönüştürülemedi.");
      return;
    }
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
        lessonTimezone: timezone.timeZone,
        lessonTimezoneLabel: timezone.label,
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
        lessonTimezone: timezone.timeZone,
        lessonTimezoneLabel: timezone.label,
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
                  Gelecekteki ders takvime planlanır. Ders hakkı bu aşamada düşülmez; ders tamamlandığında paketten düşülecektir.
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-xs font-semibold text-ink">
                Ders Tarihi {lessonType === "past" ? "(Geçmiş Tarih)" : "(Gelecek Tarih)"}
                <ControlledLessonDate label="Ders tarihi GG.AA.YYYY" value={lessonDate} onChange={setLessonDate} />
              </label>

              <label className="block text-xs font-semibold text-ink">
                Saat
                <ControlledLessonTime label="Ders saati HH:mm" value={lessonTime} onChange={setLessonTime} />
              </label>
              <label className="block text-xs font-semibold text-ink">
                Saat Dilimi
                <select value={timezoneLabel} onChange={(event) => setTimezoneLabel(event.target.value as LessonTimezoneLabel)} className="mt-1 min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs text-ink outline-none focus:border-primary cursor-pointer">
                  {LESSON_TIMEZONES.map((zone) => <option key={zone.label} value={zone.label}>{zone.display}</option>)}
                </select>
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
              <h3 className="font-heading text-base font-bold text-ink">Paket Hakkı Düzeltmesi</h3>
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
              {busy ? "İşleniyor..." : "Paketi Güncelle"}
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

  const [date, setDate] = useState(() => localDayKey(currentStart ? new Date(currentStart) : new Date()));
  const [time, setTime] = useState(() => {
    const d = currentStart ? new Date(currentStart) : new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(currentDurationMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    onClose();
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
              <ControlledLessonDate label="Yeni tarih GG.AA.YYYY" value={date} onChange={setDate} />
            </label>
            <label className="text-xs font-semibold text-ink">
              Yeni Saat
              <ControlledLessonTime label="Yeni saat HH:mm" value={time} onChange={setTime} />
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
