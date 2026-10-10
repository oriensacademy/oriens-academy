"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { invalidateStudentData, queryKeys, useQuery } from "@/lib/data/query-store";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  PackagePlus,
  Plus,
  Minus,
  Save,
  Send,
  StickyNote,
  Video,
  XCircle,
  History,
  Mail,
  Check,
  CalendarPlus,
  Pencil,
  Trash2,
  ArrowLeft,
  X,
  Settings,
  BookOpen,
  Lock,
  ChevronDown,
  ArrowDownWideNarrow,
  Package,
  CreditCard,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";
import {
  addStudentPrivateNote,
  updateStudentPrivateNote,
  deleteStudentPrivateNote,
  assignStudentPackage,
  adjustStudentPackageLessons,
  cancelStudentLesson,
  completeStudentLesson,
  recordCompletedLesson,
  saveAndSendLessonReport,
  saveLessonCompletionReport,
  listStudentLearning,
  sendLessonMeetingLink,
  sendPackageNotificationEmail,
  getPackageRightsNotificationContext,
  sendPackageRightsNotification,
  upsertStudentLesson,
  type PackageOption,
  type PackagePurchase,
  type PackageAdjustment,
  type StudentPayment,
  type LessonNotificationState,
  type LessonReference,
  type InstructorReference,
  updateCompletedLesson,
} from "@/lib/admin/student-learning";
import { ControlledLessonDate, ControlledLessonTime, withDefaultLessonMinute } from "@/components/admin/ControlledLessonDateTime";
import { LessonReferenceManagerModal } from "@/components/admin/LessonReferenceManagerModal";
import { RefHakDialog, RefLessonDialog, RefPkDialog, lessonRightsReasonFromNote, type RefLessonForm } from "@/components/admin/StudentRefDialogs";
import { AssignHomeworkModal } from "@/components/admin/homework/AssignHomeworkModal";
import { HomeworkSubmissionReview } from "@/components/admin/HomeworkSubmissionReview";
import type { Tables } from "@/types/database.types";
import { listStudentExamAttempts, type StudentExamAttempt } from "@/lib/student/exam-history";
import { ExamQuestionReview } from "@/components/exam-test/ExamQuestionReview";
import { canonicalExams } from "@/content/canonical-exams";
import { adminLessonCopy } from "@/content/admin-lessons";
import { ADMIN_UI_FEATURES } from "@/config/admin-ui";
import { previewLessonAdjustment } from "@/lib/admin/lesson-adjustments";
import { useToast } from "@/components/ui/toast";
import { TrNumberInput } from "@/components/admin/TrNumberInput";
import { packageDisplayName } from "@/lib/packages/display";
import type { BookingWithSlot } from "@/lib/admin/bookings";
import {
  DEFAULT_LESSON_TIMEZONE_LABEL,
  LESSON_TIMEZONES,
  formatLessonDateTime,
  lessonInstantToLocalInput,
  lessonTimezoneForLabel,
  localLessonDateTimeToUtc,
  type LessonTimezoneLabel,
} from "@/lib/lessons/timezones";


// Yerel gün anahtarı (YYYY-MM-DD); toISOString UTC günü verdiği için kullanılmaz.
const localDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Boş dizi kimliğini sabit tut: her render'da yeni [] üretmek alt
 *  componentlerin efekt bağımlılıklarını gereksizce tetikliyor. */
const EMPTY_ARRAY: never[] = [];

function deliveryStatusText(delivery: LessonNotificationState | undefined, label: string) {
  if (!delivery) return `${label} henüz gönderilmedi.`;
  if (delivery.status === "sent") {
    return `${label} gönderildi${delivery.sent_at ? ` · ${new Date(delivery.sent_at).toLocaleString("tr-TR")}` : ""}.`;
  }
  if (delivery.status === "failed") return `${label} gönderilemedi.`;
  if (delivery.status === "cancelled") return `${label} iptal edildi.`;
  return "E-posta gönderim sırasında.";
}

export type LearningSection = "lessons" | "homework" | "packages" | "payments" | "notes" | "exam_history";

type NormalizedSessionBase = {
  group: "upcoming" | "past";
  id: string;
  title: string;
  subject: string;
  date: string;
  duration: number | null;
  status: string;
  card: ReactNode;
};
type LessonRow = Tables<"student_lessons"> & { topic_id?: string | null; instructor_id?: string | null };

export type NormalizedSessionItem = NormalizedSessionBase & (
  | { type: "lesson"; source: Tables<"student_lessons"> }
  | { type: "booking"; source: BookingWithSlot }
);

export function StudentLearningManager({
  userId,
  studentName = "Seçili öğrenci",
  section,
  onChanged,
  onPlan,
  renderSessionView,
  referenceMode = false,
  actionRequest,
  notifyEmail = "",
  onAddPackage,
}: {
  userId: string;
  studentName?: string;
  section: LearningSection;
  onChanged?: () => void;
  onPlan?: () => void;
  renderSessionView?: (lessonSessions: NormalizedSessionItem[]) => ReactNode;
  referenceMode?: boolean;
  actionRequest?: { type: "add_lesson" | "add_package" | "add_note"; nonce: number } | null;
  /** Referans pencerelerindeki "Veliye gönderilir (...)" satırı. */
  notifyEmail?: string;
  onAddPackage?: () => void;
}) {
  // Mutasyon hataları veri hatasından ayrı tutulur: bir kaydetme hatası,
  // ekranda duran geçerli veriyi silmemeli.
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);

  // Bu component öğrenci detayında aynı anda 4 kez mount ediliyor (Eğitim,
  // Paket, Ödemeler, Notlar). Eskiden her biri kendi `listStudentLearning`
  // çağrısını yapıyordu: sekmeleri gezmek 28 sorgu üretiyordu ve bir sekmede
  // yapılan mutasyon diğerlerinde bayat veri bırakıyordu. Artık hepsi aynı
  // önbellek anahtarını paylaşıyor -> tek istek, ve `invalidateStudentData()`
  // sonrası dördü birden anında güncelleniyor.
  const { data, error: queryError } = useQuery(
    queryKeys.studentLearning(userId),
    () => listStudentLearning(userId),
    { staleTime: 30_000, enabled: !!userId }
  );

  const lessons = (data?.lessons ?? EMPTY_ARRAY) as LessonRow[];
  const homework = (data?.homework ?? EMPTY_ARRAY) as Tables<"student_homework">[];
  const purchases = (data?.purchases ?? EMPTY_ARRAY) as PackagePurchase[];
  const payments = (data?.payments ?? EMPTY_ARRAY) as StudentPayment[];
  const notes = (data?.notes ?? EMPTY_ARRAY) as Tables<"student_admin_notes">[];
  const packages = (data?.packages ?? EMPTY_ARRAY) as PackageOption[];
  const adjustments = (data?.adjustments ?? EMPTY_ARRAY) as PackageAdjustment[];
  const lessonNotifications = (data?.lessonNotifications ?? EMPTY_ARRAY) as LessonNotificationState[];
  const rightsNotification = (data?.rightsNotification ?? null) as LessonNotificationState | null;
  const topics = (data?.topics ?? EMPTY_ARRAY) as LessonReference[];
  const instructors = (data?.instructors ?? EMPTY_ARRAY) as InstructorReference[];

  // Yalnızca bu bölümün gerçekten okuduğu tabloların hatası bu bölümü durdurur.
  const sectionTables: Record<LearningSection, Array<keyof NonNullable<typeof data>["errors"]>> = {
    lessons: ["lessons", "purchases", "notifications", "references"],
    homework: ["homework", "lessons"],
    packages: ["purchases", "packages", "adjustments"],
    payments: ["payments"],
    notes: ["notes"],
    exam_history: [],
  };
  const sectionError =
    data?.errors ? sectionTables[section].map((table) => data.errors[table]).find(Boolean) ?? "" : "";

  const error = mutationError || queryError || sectionError || "";
  const setError = setMutationError;

  const changed = () => {
    // Tek noktadan geçersiz kılma: öğrenci listesi, detayın tüm sekmeleri ve
    // öğrenci portalı aynı anda tazelenir.
    invalidateStudentData();
    onChanged?.();
  };

  if (error) return <Notice tone="error">{error}</Notice>;

  if (section === "lessons") {
    return (
      <LessonsPanel
        lessons={lessons}
        purchases={purchases}
        lessonNotifications={lessonNotifications}
        topics={topics}
        instructors={instructors}
        userId={userId}
        studentName={studentName}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        changed={changed}
        onPlan={onPlan}
        renderSessionView={renderSessionView}
        referenceMode={referenceMode}
        actionRequest={actionRequest}
        notifyEmail={notifyEmail}
        onAddPackage={onAddPackage}
      />
    );
  }

  if (section === "homework") {
    return (
      <HomeworkPanel
        homework={homework}
        lessons={lessons}
        userId={userId}
        studentName={studentName}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        changed={changed}
      />
    );
  }

  if (section === "packages") {
    return (
      <PackagePanel
        purchases={purchases}
        payments={payments}
        packages={packages}
        adjustments={adjustments}
        rightsNotification={rightsNotification}
        userId={userId}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        changed={changed}
        actionRequest={actionRequest}
        referenceMode={referenceMode}
        notifyEmail={notifyEmail}
      />
    );
  }

  if (section === "payments") {
    if (referenceMode) {
      return (
        <section className="overflow-hidden rounded-[20px] border border-[#E6E4DC] bg-white">
          <div className="border-b border-[#E6E4DC] px-6 py-5"><h2 className="font-heading text-[22px] font-semibold text-[#1C231E]">Ödeme Geçmişi</h2></div>
          {payments.length ? payments.map((payment) => {
            const failed = payment.status === "failed" || payment.status === "cancelled";
            const refunded = payment.refund_status === "full";
            return (
              <div key={payment.id} className={`flex flex-wrap items-center gap-4 border-b border-[#E6E4DC] px-6 py-4 last:border-b-0 ${failed ? "bg-[#FFF9F8]" : ""}`}>
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${failed ? "bg-[#FBECEA] text-[#9A3324]" : "bg-[#F7F6F1] text-[#A57622]"}`}><CreditCard className="size-5" /></span>
                <div className="min-w-[200px] flex-1"><div className="text-[15px] font-semibold text-[#1C231E]">{packageDisplayName(purchases.find((purchase) => purchase.payment_transaction_id === payment.id) || { package_id: payment.package_id })}</div><div className="mt-1 text-[13px] text-[#5B635C]">{longDate(payment.paid_at || payment.created_at)} · {paymentMethodLabel(payment.payment_method)}</div></div>
                <strong className={`text-[15px] ${failed ? "text-[#5B635C] line-through" : "text-[#1C231E]"}`}>{symbolMoney(payment.amount, payment.currency)}</strong>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${failed ? "bg-[#FBECEA] text-[#9A3324]" : refunded ? "bg-[#EEE9F8] text-[#6B4BB8]" : "bg-[#E4ECE5] text-[#1E3D2B]"}`}>{failed ? "Başarısız" : refunded ? "İade Edildi" : formatPaymentStatus(payment.status)}</span>
              </div>
            );
          }) : <div className="px-6 py-10 text-center text-sm text-[#5B635C]">Bu öğrenciyle bağlantılı ödeme kaydı yok.</div>}
        </section>
      );
    }
    return (
      <div className="space-y-2">
        {payments.length ? (
          payments.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between gap-3">
                <div><strong>{money(p.amount, p.currency)}</strong><span className="ml-2 text-xs text-muted-foreground">{packageDisplayName(purchases.find((purchase) => purchase.payment_transaction_id === p.id) || { package_id: p.package_id })}</span></div>
                <Badge>{p.refund_status === "full" ? "İade Edildi" : p.refund_status === "partial" ? "Kısmen İade Edildi" : formatPaymentStatus(p.status)}</Badge>
              </div>
              <p>
                {p.payment_method === "bank_transfer" ? "Havale / EFT" : "Kart"} · {p.public_reference} ·{" "}
                Ödeme tarihi: {new Date(p.paid_at || p.created_at).toLocaleString("tr-TR")}
              </p>
              {Number(p.refunded_amount || 0) > 0 ? (
                <p className="mt-1 text-purple-800">
                  İade edilen: {money(Number(p.refunded_amount), p.currency)} · Kalan iade edilebilir: {money(Math.max(0, Number(p.amount) - Number(p.refunded_amount)), p.currency)}
                  {p.last_refunded_at ? ` · İade tarihi: ${new Date(p.last_refunded_at).toLocaleString("tr-TR")}` : ""}
                </p>
              ) : null}
            </Card>
          ))
        ) : (
          <Empty>Bu öğrenciyle bağlantılı ödeme kaydı yok.</Empty>
        )}
      </div>
    );
  }

  if (section === "exam_history") {
    return <AdminExamHistoryPanel userId={userId} />;
  }

  return (
    <NotesPanel
      notes={notes}
      busy={busy}
      setBusy={setBusy}
      setError={setError}
      userId={userId}
      changed={changed}
      referenceMode={referenceMode}
      actionRequest={actionRequest}
    />
  );
}

// ----------------------------------------------------------------------------
// LESSONS & LIVE LESSON LINK PANEL
// ----------------------------------------------------------------------------

function LessonsPanel({
  lessons,
  purchases,
  lessonNotifications,
  topics,
  instructors,
  userId,
  studentName,
  busy,
  setBusy,
  setError: setPanelError,
  changed,
  onPlan,
  renderSessionView,
  referenceMode,
  actionRequest,
  notifyEmail,
  onAddPackage,
}: {
  lessons: LessonRow[];
  purchases: PackagePurchase[];
  lessonNotifications: LessonNotificationState[];
  topics: LessonReference[];
  instructors: InstructorReference[];
  userId: string;
  studentName: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
  onPlan?: () => void;
  renderSessionView?: (lessonSessions: NormalizedSessionItem[]) => ReactNode;
  referenceMode: boolean;
  actionRequest?: { type: "add_lesson" | "add_package" | "add_note"; nonce: number } | null;
  notifyEmail: string;
  onAddPackage?: () => void;
}) {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const toast = useToast();
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonTypeSelection, setLessonTypeSelection] = useState<"past" | "future" | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Tables<"student_lessons"> | null>(null);
  const [completionPackagePurchaseId, setCompletionPackagePurchaseId] = useState("");
  const [expandedReports, setExpandedReports] = useState<Set<string>>(() => new Set());
  const [archiveNow] = useState(() => Date.now());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Manual email dispatch is tracked per button, not through the panel-wide
  // `busy` flag: only the clicked button spins and disables, the sheet stays
  // open, and nothing else on the panel is blocked. `sentEmails` flips the
  // label to "Tekrar Gonder" once a deliberate first send has succeeded.
  const [sendingEmailKey, setSendingEmailKey] = useState<string | null>(null);
  const [, setSentEmails] = useState<Set<string>>(new Set());
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [referenceManager, setReferenceManager] = useState<"topic" | "instructor" | null>(null);
  const [editCompletedTarget, setEditCompletedTarget] = useState<LessonRow | null>(null);
  const lessonCopy = adminLessonCopy.tr;
  // Referans penceresi açıkken hata pencerenin içinde gösterilir; panel
  // hatası (setPanelError) tüm bölümü hata kutusuna çevirip pencereyi kapatır.
  const [lessonDialogError, setLessonDialogError] = useState("");
  const setError = useCallback((message: string) => {
    if (referenceMode && isLessonModalOpen) setLessonDialogError(message);
    else setPanelError(message);
  }, [referenceMode, isLessonModalOpen, setPanelError]);

  useEffect(() => {
    if (actionRequest?.type !== "add_lesson") return;
    const timer = window.setTimeout(() => {
      setIsLessonModalOpen(true);
      setLessonTypeSelection("past");
      setLessonDialogError("");
      setPanelError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [actionRequest?.nonce, actionRequest?.type, setPanelError]);

  useEffect(() => {
    // Yapılan ders penceresi native <dialog>; Escape onu kendi onCancel'ı kapatır.
    if (!referenceMode || !isLessonModalOpen || lessonTypeSelection === "past") return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsLessonModalOpen(false); setLessonTypeSelection(null); }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [isLessonModalOpen, lessonTypeSelection, referenceMode]);

  const activePackage = purchases.find((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0) || null;

  const nowIso = lessonInstantToLocalInput(new Date(), "Europe/Istanbul");
  const [form, setForm] = useState({
    topicId: "",
    customTitle: "",
    subject: "",
    instructorId: "",
    examCode: "SAT",
    lessonDate: nowIso.slice(0,10),
    startTime: withDefaultLessonMinute(nowIso.slice(11,16)),
    timezoneLabel: DEFAULT_LESSON_TIMEZONE_LABEL as LessonTimezoneLabel,
    durationMinutes: 60,
    packagePurchaseId: activePackage?.id || "",
    liveMeetingUrl: "",
    teacherNote: "",
    sendNotification: false,
  });
  const [pastRequestKey, setPastRequestKey] = useState(() => crypto.randomUUID());
  const [pastForm, setPastForm] = useState({
    date: localDayKey(new Date()),
    startTime: withDefaultLessonMinute(new Date().toTimeString().slice(0, 5)),
    timezoneLabel: DEFAULT_LESSON_TIMEZONE_LABEL as LessonTimezoneLabel,
    durationMinutes: 60,
    topicId: "",
    customTitle: "",
    subject: "",
    instructorId: "",
    packagePurchaseId: "",
    completionReport: "",
    sendEmail: false,
  });
  async function handleRecordPastLesson(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!pastForm.packagePurchaseId) {
      setError("Ders hakkının düşüleceği aktif paketi seçin.");
      return;
    }
    const selectedCourse = topics.find((item) => item.id === pastForm.topicId);
    const title = pastForm.topicId === "other" ? pastForm.customTitle.trim() : selectedCourse?.label.trim() || "";
    const subject = pastForm.subject.trim();
    const completionReport = pastForm.completionReport.trim();
    if (!title) {
      setError("Ders seçin veya Ders Adı alanını doldurun.");
      return;
    }
    if (!pastForm.instructorId) {
      setError("Eğitmen seçilmelidir.");
      return;
    }
    if (!subject) {
      setError("Konu / Alan girilmelidir.");
      return;
    }
    if (completionReport && completionReport.length < 5) {
      setError("Ders sonu raporu en az 5 karakter olmalıdır.");
      return;
    }
    if (pastForm.sendEmail && !completionReport) {
      setError("E-posta göndermek için ders sonu raporu girilmelidir.");
      return;
    }
    setBusy(true);
    setError("");

    const timezone = lessonTimezoneForLabel(pastForm.timezoneLabel);
    let lessonIso: string;
    try {
      lessonIso = localLessonDateTimeToUtc(`${pastForm.date}T${pastForm.startTime}`, timezone.timeZone);
    } catch (conversionError) {
      setBusy(false);
      setError(conversionError instanceof Error ? conversionError.message : "Ders saati dönüştürülemedi.");
      return;
    }
    const lessonTime = new Date(lessonIso).getTime();
    if (lessonTime > Date.now() + 5 * 60_000) {
      setBusy(false);
      setError("Geçmiş ders için ileri bir tarih veya saat seçilemez. Lütfen geçmiş bir tarih giriniz veya 'Gelecek Ders' seçeneğini kullanınız.");
      return;
    }

    const res = await recordCompletedLesson({
      studentId: userId,
      lessonDate: lessonIso,
      durationMinutes: pastForm.durationMinutes,
      title,
      subject,
      teacherNote: null,
      packagePurchaseId: pastForm.packagePurchaseId || null,
      idempotencyKey: `admin-past:${pastRequestKey}`,
      lessonTimezone: timezone.timeZone,
      lessonTimezoneLabel: timezone.label,
      topicId: pastForm.topicId === "other" ? null : pastForm.topicId || null,
      instructorId: pastForm.instructorId || null,
      completionReport: completionReport || null,
      sendReportEmail: pastForm.sendEmail,
    });
    if (!res.success) {
      setBusy(false);
      setError(res.error || lessonCopy.failure);
      return;
    }
    setBusy(false);
    setIsLessonModalOpen(false);
    setLessonTypeSelection(null);
    setPastRequestKey(crypto.randomUUID());
    toast.success("Yapılan ders kaydedildi ve paketten 1 ders hakkı düşüldü.");
    changed();
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    const selectedCourse = topics.find((item) => item.id === form.topicId);
    const title = form.topicId === "other" ? form.customTitle.trim() : selectedCourse?.label.trim() || "";
    const subject = form.subject.trim();
    if (!title) {
      setError("Ders seçin veya Ders Adı alanını doldurun.");
      return;
    }
    if (!subject) {
      setError("Konu / Alan girilmelidir.");
      return;
    }
    setBusy(true);
    setError("");

    const timezone = lessonTimezoneForLabel(form.timezoneLabel);
    let lessonIso: string;
    try {
      lessonIso = localLessonDateTimeToUtc(`${form.lessonDate}T${form.startTime}`, timezone.timeZone);
    } catch (conversionError) {
      setBusy(false);
      setError(conversionError instanceof Error ? conversionError.message : "Ders saati dönüştürülemedi.");
      return;
    }
    const lessonTime = new Date(lessonIso).getTime();
    if (lessonTime < Date.now() - 15 * 60_000) {
      setBusy(false);
      setError("Gelecek ders için geçmiş bir tarih veya saat seçilemez. Lütfen ileri bir tarih giriniz veya 'Geçmiş Ders' seçeneğini kullanınız.");
      return;
    }

    const res = await upsertStudentLesson({
      studentId: userId,
      packagePurchaseId: form.packagePurchaseId || null,
      title,
      subject,
      examCode: form.examCode.trim() || null,
      lessonDate: lessonIso,
      lessonTimezone: timezone.timeZone,
      lessonTimezoneLabel: timezone.label,
      durationMinutes: Number(form.durationMinutes) || 60,
      liveMeetingUrl: form.liveMeetingUrl.trim() || null,
      teacherNote: form.teacherNote.trim() || null,
      status: "scheduled",
      topicId: form.topicId === "other" ? null : form.topicId || null,
      instructorId: form.instructorId || null,
    });

    if (!res.success) {
      setBusy(false);
      setError(res.error || "Ders kaydedilemedi.");
    } else {
      let notificationFailed = false;
      if (form.sendNotification && res.lessonId) {
        const mail = await sendLessonMeetingLink(res.lessonId);
        notificationFailed = !mail.success;
      }
      setBusy(false);
      setIsLessonModalOpen(false);
      setLessonTypeSelection(null);
      toast.success(notificationFailed
        ? "Ders planlandı; ancak bağlantı e-postası gönderilemedi. Ders kartından tekrar deneyebilirsiniz."
        : `Gelecek ders planlandı${form.sendNotification ? " ve bağlantı e-postası gönderildi" : ""}. Ders hakkı tamamlandığında düşecektir.`);
      changed();
    }
  }

  // MAIL-026: explicit admin action only. Creating a lesson, adding a meeting
  // link or updating one never sends this mail on its own.
  async function handleSendLink(lesson: Tables<"student_lessons">) {
    const key = `link-${lesson.id}`;
    if (sendingEmailKey === key) return;
    setSendingEmailKey(key);
    setError("");
    const res = await sendLessonMeetingLink(lesson.id);
    setSendingEmailKey(null);
    if (!res.success) {
      setError(res.error || "Bağlantı e-postası gönderilemedi.");
    } else {
      setSentEmails((prev) => new Set(prev).add(key));
      toast.success("Canlı ders bağlantısı öğrenciye başarıyla gönderildi.");
      changed();
    }
  }

  async function handleConfirmComplete() {
    if (!completeTarget) return;
    if (!completionPackagePurchaseId) {
      setError("Ders hakkının düşüleceği aktif paketi seçin.");
      return;
    }
    setBusy(true);
    setError("");

    const res = await completeStudentLesson({
      lessonId: completeTarget.id,
      packagePurchaseId: completionPackagePurchaseId,
    });

    if (!res.success) {
      setBusy(false);
      setError(res.error || "Ders tamamlanamadı.");
    } else {
      setBusy(false);
      setCompleteTarget(null);
      setCompletionPackagePurchaseId("");
      toast.success(
        res.alreadyCompleted
          ? "Ders zaten tamamlanmış olarak işaretliydi."
          : "Ders tamamlandı ve paketten 1 ders düşürüldü."
      );
      changed();
    }
  }

  async function handleSaveReport(lesson: Tables<"student_lessons">, send: boolean) {
    const report = (reportDrafts[lesson.id] ?? lesson.completion_report ?? "").trim();
    if (report.length < 5 || report.length > 10000) {
      toast.error(report.length > 10000 ? "Ders sonu raporu 10.000 karakteri aşamaz." : "Ders sonu raporu en az 5 karakter olmalıdır.");
      return;
    }
    const key = `${send ? "send-report" : "save-report"}-${lesson.id}`;
    if (sendingEmailKey === key) return;
    setSendingEmailKey(key);
    setError("");
    const saved = await saveLessonCompletionReport(lesson.id, report);
    if (!saved.success) {
      setSendingEmailKey(null);
      toast.error(saved.error || "Ders sonu raporu kaydedilemedi.");
      return;
    }
    if (!send) {
      setSendingEmailKey(null);
      toast.success("Ders sonu raporu kaydedildi.");
      changed();
      return;
    }
    const previouslySent = Boolean(lesson.report_email_sent_at);
    const result = await saveAndSendLessonReport(lesson.id, report, previouslySent);
    setSendingEmailKey(null);
    if (!result.success) {
      toast.error("Rapor kaydedildi ancak e-posta gönderilemedi. Lütfen tekrar deneyin.");
      changed();
      return;
    }
    setSentEmails((prev) => new Set(prev).add(key));
    toast.success(previouslySent
      ? "Güncellenmiş ders sonu raporu tekrar gönderildi."
      : "Ders sonu raporu ve kalan ders hakkı e-postası gönderildi.");
    changed();
  }

  function handleCancelLesson(lessonId: string) {
    requestConfirmation({ title: "Dersi iptal et", description: "Planlanan ders iptal edilecek ve öğrenci programındaki durum güncellenecektir.", confirmLabel: "İptal Et", action: async () => {
      setBusy(true); setError("");
      const res = await cancelStudentLesson(lessonId, "Yönetici tarafından iptal edildi.");
      setBusy(false);
      if (!res.success) setError(res.error || "İptal edilemedi."); else { toast.success("Ders iptal edildi."); changed(); }
    }});
  }

  function copyUrl(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // student_lessons is the canonical lesson source. Future scheduled lessons
  // are chronological; archive records are newest-first.
  const upcomingLessons = lessons
    .filter((lesson) => lesson.status === "scheduled" && new Date(lesson.lesson_date).getTime() >= archiveNow)
    .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));
  const pastLessons = lessons
    .filter((lesson) => lesson.status !== "scheduled" || new Date(lesson.lesson_date).getTime() < archiveNow)
    .sort((a, b) => b.lesson_date.localeCompare(a.lesson_date));
  const orderedLessons = [...upcomingLessons, ...pastLessons];

  return (
    <div className="space-y-4">
      {confirmationDialog}
      {referenceManager && !(referenceMode && (isLessonModalOpen || editCompletedTarget)) && <LessonReferenceManagerModal kind={referenceManager} items={referenceManager==="topic"?topics:instructors} onClose={()=>setReferenceManager(null)} onChanged={changed}/>}
      {referenceMode && isLessonModalOpen && lessonTypeSelection === "past" && (
        <RefLessonDialog
          mode="create"
          studentName={studentName}
          notifyEmail={notifyEmail}
          form={pastForm}
          onChange={(patch: Partial<RefLessonForm>) => setPastForm((current) => ({ ...current, ...patch }))}
          topics={topics}
          instructors={instructors}
          purchases={purchases.filter((purchase) => purchase.status === "active" && purchase.lessons_used < purchase.lesson_count)}
          busy={busy}
          error={lessonDialogError}
          onClose={() => { if (referenceManager) return; setIsLessonModalOpen(false); setLessonTypeSelection(null); }}
          onSubmit={handleRecordPastLesson}
          onManage={setReferenceManager}
          onAddPackage={onAddPackage}
        >
          {referenceManager && <LessonReferenceManagerModal kind={referenceManager} items={referenceManager==="topic"?topics:instructors} onClose={()=>setReferenceManager(null)} onChanged={changed}/>}
        </RefLessonDialog>
      )}
      {referenceMode && editCompletedTarget && (
        <RefCompletedLessonEditDialog lesson={editCompletedTarget} purchases={purchases} topics={topics} instructors={instructors} studentName={studentName} notifyEmail={notifyEmail} onManage={setReferenceManager} onClose={()=>{if(!referenceManager)setEditCompletedTarget(null);}} onSaved={()=>{setEditCompletedTarget(null);changed();toast.success("Tamamlanmış ders güncellendi.");}}>
          {referenceManager && <LessonReferenceManagerModal kind={referenceManager} items={referenceManager==="topic"?topics:instructors} onClose={()=>setReferenceManager(null)} onChanged={changed}/>}
        </RefCompletedLessonEditDialog>
      )}
      {!referenceMode && editCompletedTarget && <CompletedLessonEditModal lesson={editCompletedTarget} purchases={purchases} topics={topics} instructors={instructors} onClose={()=>setEditCompletedTarget(null)} onSaved={()=>{setEditCompletedTarget(null);changed();toast.success("Tamamlanmış ders güncellendi.");}}/>}

      {/* Tek ve anlaşılır ders oluşturma alanı */}
      <div className={`flex flex-wrap items-center justify-between gap-5 border bg-white ${referenceMode ? "rounded-[20px] border-[#E6E4DC] p-6" : "rounded-2xl border-border p-4"}`}>
        <div className="flex items-center gap-4">
          {referenceMode && <span className="flex size-[52px] items-center justify-center rounded-[14px] bg-[#E4ECE5] text-[#2B4234]"><Video className="size-6" /></span>}
          <div>
          <h4 className={`font-heading font-semibold text-[#1C231E] ${referenceMode ? "text-2xl" : "flex items-center gap-1.5 text-sm font-bold"}`}>
            {!referenceMode && <Video className="size-4 text-primary" />}
            Ders Yönetimi
          </h4>
          {!referenceMode && <p className="mt-1 text-[11px] text-muted-foreground">Yapılan dersi sisteme ekleyin.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setIsLessonModalOpen(true);
              setLessonTypeSelection("past");
              setLessonDialogError("");
              setError("");
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 font-semibold shadow-xs cursor-pointer ${referenceMode ? "min-h-11 border border-[#1D1E1B] bg-[#1D1E1B] pl-2.5 text-sm font-bold text-white shadow-[0_6px_16px_rgba(20,20,18,0.18)] hover:bg-[#30312C]" : "min-h-10 border border-border bg-white text-xs font-bold text-ink hover:bg-surface-muted"}`}
          >
            {referenceMode
              ? <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#D9AE57]/25 text-[#D9AE57]" aria-hidden="true"><Plus className="size-3.5" /></span>
              : <History className="size-4 text-emerald-700" />}
            Ders Kaydı Ekle
          </button>
          {ADMIN_UI_FEATURES.showFutureLessonPlanning && <button
            type="button"
            onClick={() => {
              setIsLessonModalOpen(true);
              setLessonTypeSelection("future");
              setError("");
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-bold text-white shadow-xs hover:bg-forest cursor-pointer"
          >
            <CalendarPlus className="size-4" />
            İleri Tarihli Ders Planla
          </button>}
        </div>
      </div>

      {isLessonModalOpen && !(referenceMode && lessonTypeSelection === "past") && (
        <div
          className={referenceMode ? "fixed inset-0 z-[170] flex items-center justify-center overflow-y-auto bg-[#10271B]/55 p-4" : ""}
          role={referenceMode ? "dialog" : undefined}
          aria-modal={referenceMode ? "true" : undefined}
          aria-labelledby={referenceMode ? "lesson-create-title" : undefined}
          onMouseDown={referenceMode ? (event) => { if (event.target === event.currentTarget) { setIsLessonModalOpen(false); setLessonTypeSelection(null); } } : undefined}
        >
        <div className={`grid gap-4 border bg-white text-xs animate-in fade-in zoom-in-95 duration-150 ${referenceMode ? "max-h-[calc(100dvh-32px)] w-full max-w-[760px] overflow-y-auto rounded-[24px] border-[#E6E4DC] p-6 shadow-[0_24px_60px_rgba(16,39,27,0.18)]" : "rounded-2xl border-border p-4 shadow-md sm:p-5"}`}>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div id="lesson-create-title" className="font-heading text-[22px] font-semibold text-ink">
                {lessonTypeSelection === "past" ? "Ders Kaydı Ekle" : "İleri Tarihli Ders Planla"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {studentName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLessonModalOpen(false);
                setLessonTypeSelection(null);
              }}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-muted cursor-pointer"
            >
              Kapat
            </button>
          </div>

          {/* Mandatory Conscious Radio Selection */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <label className="text-xs font-bold text-ink block">
              Ders Türü (Zorunlu Seçim)
            </label>
            <div className={`grid gap-2.5 ${ADMIN_UI_FEATURES.showFutureLessonPlanning ? "sm:grid-cols-2" : ""}`}>
              <label
                className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                  lessonTypeSelection === "past"
                    ? "border-emerald-600 bg-white shadow-xs ring-1 ring-emerald-600"
                    : "border-border bg-white/70 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="adminLessonTypeRadio"
                  value="past"
                  checked={lessonTypeSelection === "past"}
                  onChange={() => {
                    setLessonTypeSelection("past");
                    setError("");
                  }}
                  className="mt-0.5 size-4 text-emerald-700 focus:ring-emerald-700"
                />
                <div>
                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <History className="size-3.5 text-emerald-700" />
                    <span>Yapılan Ders</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    Tamamlanmış bir dersin kaydı oluşturulur ve öğrencinin aktif paketinden 1 ders hakkı düşülür.
                  </div>
                </div>
              </label>

              {ADMIN_UI_FEATURES.showFutureLessonPlanning && <label
                className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                  lessonTypeSelection === "future"
                    ? "border-primary bg-white shadow-xs ring-1 ring-primary"
                    : "border-border bg-white/70 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="adminLessonTypeRadio"
                  value="future"
                  checked={lessonTypeSelection === "future"}
                  onChange={() => {
                    setLessonTypeSelection("future");
                    setError("");
                  }}
                  className="mt-0.5 size-4 text-primary focus:ring-primary"
                />
                <div>
                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Video className="size-3.5 text-primary" />
                    <span>○ Gelecek Ders</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    Gelecekteki bir canlı ders takvime planlanır. Ders hakkı bu aşamada düşülmez; ders tamamlandığında paketten düşülecektir.
                  </div>
                </div>
              </label>}
            </div>
          </div>

          {lessonTypeSelection === null && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-center text-xs text-amber-900">
              Devam etmek için lütfen ders türünü seçiniz.
            </div>
          )}

          {/* Form for PAST Lesson */}
          {lessonTypeSelection === "past" && (
            <form onSubmit={handleRecordPastLesson} className="grid gap-3 animate-in fade-in duration-150">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-semibold text-muted-foreground">Ders<div className="flex gap-2"><select required value={pastForm.topicId} onChange={(event)=>setPastForm({...pastForm,topicId:event.target.value,customTitle:event.target.value === "other" ? pastForm.customTitle : ""})} className={field}><option value="">Ders seçin</option>{topics.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}<option value="other">Diğer</option></select><button type="button" title="Dersleri yönet" onClick={()=>setReferenceManager("topic")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white"><Settings className="size-4"/></button></div></label>
                <label className="font-semibold text-muted-foreground">Eğitmen <span className="text-rose-600">*</span><div className="flex gap-2"><select required value={pastForm.instructorId} onChange={(event)=>setPastForm({...pastForm,instructorId:event.target.value})} className={field}><option value="">Eğitmen seçin</option>{instructors.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" title="Eğitmenleri yönet" onClick={()=>setReferenceManager("instructor")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white"><Settings className="size-4"/></button></div></label>
              </div>
              {pastForm.topicId === "other" && <label className="font-semibold text-muted-foreground">Ders Adı<Input required placeholder="Örn. College Math" value={pastForm.customTitle} onChange={(customTitle)=>setPastForm({...pastForm,customTitle})}/></label>}
              <label className="font-semibold text-muted-foreground">Konu / Alan<Input required placeholder="Örn. Integration by Parts" value={pastForm.subject} onChange={(subject)=>setPastForm({...pastForm,subject})}/></label>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.date}
                  <ControlledLessonDate label="Yapılan ders tarihi GG.AA.YYYY" value={pastForm.date} onChange={(date)=>setPastForm({...pastForm,date})}/>
                </label>
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.startTime}
                  <ControlledLessonTime label="Başlangıç saati HH:mm" value={pastForm.startTime} onChange={(startTime)=>setPastForm({...pastForm,startTime})}/>
                </label>
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.duration}
                  <Input
                    required
                    type="number"
                    placeholder="60"
                    value={String(pastForm.durationMinutes)}
                    onChange={(value) => setPastForm({ ...pastForm, durationMinutes: Number(value) || 60 })}
                  />
                </label>
                <label className="font-semibold text-muted-foreground">
                  Saat Dilimi
                  <select value={pastForm.timezoneLabel} onChange={(event) => setPastForm({ ...pastForm, timezoneLabel: event.target.value as LessonTimezoneLabel })} className={field}>
                    {LESSON_TIMEZONES.map((zone) => <option key={zone.label} value={zone.label}>{zone.display}</option>)}
                  </select>
                </label>
              </div>
              <label className="font-semibold text-muted-foreground">
                Ders Hakkının Düşüleceği Paket <span className="text-rose-600">*</span>
                <select
                  required
                  value={pastForm.packagePurchaseId}
                  onChange={(event) => setPastForm({ ...pastForm, packagePurchaseId: event.target.value })}
                  className={field}
                >
                  <option value="">Aktif paket seçin</option>
                  {purchases
                    .filter((purchase) => purchase.status === "active" && purchase.lessons_used < purchase.lesson_count)
                    .map((purchase) => (
                      <option key={purchase.id} value={purchase.id}>
                        {packageDisplayName(purchase)} (
                        {purchase.lesson_count - purchase.lessons_used} {lessonCopy.remaining})
                      </option>
                    ))}
                </select>
              </label>
              <label className="font-semibold text-muted-foreground">
                Ders Sonu Raporu <span className="font-normal">(İsteğe bağlı)</span>
                <textarea
                  value={pastForm.completionReport}
                  onChange={(event)=>setPastForm({...pastForm,completionReport:event.target.value})}
                  maxLength={10000}
                  rows={5}
                  placeholder="İşlenen konular, öğrencinin gelişimi ve sonraki çalışma önerileri..."
                  className={field}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 text-xs font-semibold text-ink"><input type="checkbox" checked={pastForm.sendEmail} onChange={(event)=>setPastForm({...pastForm,sendEmail:event.target.checked})}/><span>E-posta gönder</span></label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-surface-muted cursor-pointer"
                >
                  {lessonCopy.cancel}
                </button>
                <button
                  disabled={busy}
                  className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? lessonCopy.saving : "Yapılan Dersi Kaydet"}
                </button>
              </div>
            </form>
          )}

          {/* Form for FUTURE Lesson */}
          {lessonTypeSelection === "future" && (
            <form onSubmit={handleCreateLesson} className="grid gap-3 animate-in fade-in duration-150">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Ders<div className="mt-1 flex gap-2"><select required value={form.topicId} onChange={event=>setForm({...form,topicId:event.target.value,customTitle:event.target.value === "other" ? form.customTitle : ""})} className={field}><option value="">Ders seçin</option>{topics.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}<option value="other">Diğer</option></select><button type="button" title="Dersleri yönet" onClick={()=>setReferenceManager("topic")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white"><Settings className="size-4"/></button></div></label>
                <label className="text-[11px] font-semibold text-muted-foreground">Eğitmen<div className="mt-1 flex gap-2"><select value={form.instructorId} onChange={event=>setForm({...form,instructorId:event.target.value})} className={field}><option value="">Eğitmen seçilmedi</option>{instructors.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" title="Eğitmenleri yönet" onClick={()=>setReferenceManager("instructor")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white"><Settings className="size-4"/></button></div></label>
              </div>
              {form.topicId === "other" && <label className="text-[11px] font-semibold text-muted-foreground">Ders Adı<Input required placeholder="Örn. College Math" value={form.customTitle} onChange={(customTitle)=>setForm({...form,customTitle})}/></label>}
              <label className="text-[11px] font-semibold text-muted-foreground">Konu / Alan<Input required placeholder="Örn. Advanced Algebra" value={form.subject} onChange={(subject)=>setForm({...form,subject})}/></label>
              <div className="grid gap-2 sm:grid-cols-4">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Sınav Kodu</label>
                  <select
                    value={form.examCode}
                    onChange={(event) => setForm({ ...form, examCode: event.target.value })}
                    className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <option value="">Genel / Sınavsız</option>
                    {canonicalExams.map((exam) => (
                      <option key={exam.code} value={exam.code}>
                        {exam.displayNameTr}
                      </option>
                    ))}
                  </select>
                </div>
                <div><label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tarih (GG.AA.YYYY)</label><ControlledLessonDate label="Gelecek ders tarihi GG.AA.YYYY" value={form.lessonDate} onChange={(lessonDate)=>setForm({...form,lessonDate})}/></div>
                <div><label className="text-[11px] font-semibold text-muted-foreground block mb-1">Başlangıç Saati (HH:mm)</label><ControlledLessonTime label="Gelecek ders başlangıç saati HH:mm" value={form.startTime} onChange={(startTime)=>setForm({...form,startTime})}/></div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Süre (Dakika)</label>
                  <Input
                    required
                    type="number"
                    placeholder="60"
                    value={String(form.durationMinutes)}
                    onChange={(v) => setForm({ ...form, durationMinutes: Number(v) || 60 })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Saat Dilimi</label>
                  <select value={form.timezoneLabel} onChange={(event) => setForm({ ...form, timezoneLabel: event.target.value as LessonTimezoneLabel })} className={field}>
                    {LESSON_TIMEZONES.map((zone) => <option key={zone.label} value={zone.label}>{zone.display}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">İlişkili Paket</label>
                  <select
                    value={form.packagePurchaseId}
                    onChange={(e) => setForm({ ...form, packagePurchaseId: e.target.value })}
                    className={field}
                  >
                    <option value="">Paket Seçilmedi (Bağımsız Ders)</option>
                    {purchases
                      .filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {packageDisplayName(p)} (
                          {p.lesson_count - p.lessons_used} ders kaldı)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Canlı Ders Bağlantısı (Google Meet / Zoom URL)
                  </label>
                  <Input
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={form.liveMeetingUrl}
                    onChange={(v) => setForm({ ...form, liveMeetingUrl: v })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Eğitmen Notu / Hazırlık Yönergesi (İsteğe bağlı)
                </label>
                <textarea
                  placeholder="Öğrencinin derse hazır getirmesi gereken materyaller veya notlar..."
                  value={form.teacherNote}
                  onChange={(e) => setForm({ ...form, teacherNote: e.target.value })}
                  className={field}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] leading-relaxed text-ink">
                <input
                  type="checkbox"
                  checked={form.sendNotification}
                  onChange={(event) => setForm({ ...form, sendNotification: event.target.checked })}
                  className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
                />
                <span><strong>Ders planlama bilgisini e-postayla gönder</strong><br />Bağlantı girildiyse e-postaya eklenir; bağlantı olmadan da ders tarihi ve saati gönderilebilir.</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-surface-muted cursor-pointer"
                >
                  {lessonCopy.cancel}
                </button>
                <Submit busy={busy}>Gelecek Dersi Planla</Submit>
              </div>
            </form>
          )}
        </div>
        </div>
      )}

      {/* Coordinated In-Place Action View: Marking Lesson Completed */}
      {completeTarget && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 space-y-4 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2.5 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>Dersi Tamamlandı Olarak İşaretle</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setCompleteTarget(null); setCompletionPackagePurchaseId(""); }}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Vazgeç
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-5">
            <strong>{completeTarget.title}</strong> dersini tamamlandı olarak kaydetmek üzeresiniz.
          </p>
          <div className="rounded-xl bg-white p-3 text-xs space-y-1 text-ink/80 border border-emerald-100 shadow-xs">
            <div>• Aşağıda seçtiğiniz paketten <strong>1 ders hakkı güvenli şekilde düşülecektir</strong>.</div>
            <div>• Ders tamamlandığında otomatik e-posta gönderilmez; rapor daha sonra ders kartından hazırlanır.</div>
          </div>
          <label className="block text-[11px] font-semibold text-muted-foreground">
            Ders Hakkının Düşüleceği Paket <span className="text-rose-600">*</span>
            <select
              required
              value={completionPackagePurchaseId}
              onChange={(event) => setCompletionPackagePurchaseId(event.target.value)}
              className={`${field} mt-1`}
            >
              <option value="">Aktif paket seçin</option>
              {purchases
                .filter((purchase) => purchase.status === "active" && purchase.lessons_used < purchase.lesson_count)
                .map((purchase) => (
                  <option key={purchase.id} value={purchase.id}>
                    {packageDisplayName(purchase)} (
                    {purchase.lesson_count - purchase.lessons_used} ders kaldı)
                  </option>
                ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => { setCompleteTarget(null); setCompletionPackagePurchaseId(""); }}
              className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={busy || !completionPackagePurchaseId}
              onClick={handleConfirmComplete}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
            >
              {busy ? "İşleniyor…" : "Onayla ve Dersi Bitir"}
            </button>
          </div>
        </div>
      )}

      {referenceMode && (
        <RefCompletedLessonList
          lessons={pastLessons.filter((lesson) => lesson.status === "completed")}
          notifications={lessonNotifications}
          topics={topics}
          instructors={instructors}
          purchases={purchases}
          onEdit={setEditCompletedTarget}
          onAdd={() => { setIsLessonModalOpen(true); setLessonTypeSelection("past"); }}
        />
      )}

      {/* Lesson cards retain their action ownership here; StudentDetailSheet
          composes them chronologically with standalone booking cards. */}
      {!referenceMode && renderSessionView?.(orderedLessons.map((l) => {
            const isCompleted = l.status === "completed";
            const isCancelled = l.status === "cancelled";
            const isScheduled = l.status === "scheduled";
            const completedDelivery = lessonNotifications.find(
              (item) => item.entity_id === l.id && item.event_type === "lesson.report_email"
            );
            const reportValue = reportDrafts[l.id] ?? l.completion_report ?? "";
            const savedReport = (l.completion_report ?? "").trim();
            const reportIsDirty = reportValue.trim() !== savedReport;
            const deliveryVersion = Number(completedDelivery?.dedupe_key?.match(/:v(\d+)$/)?.[1] ?? 0);
            const currentVersion = Number(l.report_version || 0);
            const reportWasQueued = Boolean(completedDelivery || l.report_email_sent_at);
            const reportChangedAfterSend = reportWasQueued && (reportIsDirty || deliveryVersion < currentVersion);
            const reportStatus = !savedReport
              ? "Rapor Bekleniyor"
              : reportChangedAfterSend
                ? "Rapor Güncellendi — Yeniden Gönderilmedi"
                : completedDelivery?.status === "sent"
                  ? `Gönderildi — ${new Date(completedDelivery.sent_at || completedDelivery.created_at).toLocaleString("tr-TR")}`
                  : completedDelivery?.status === "failed"
                    ? "Gönderilemedi"
                    : completedDelivery?.status === "processing"
                      ? "Gönderiliyor"
                      : completedDelivery?.status === "pending"
                        ? "Kuyrukta"
                        : reportWasQueued
                          ? "Kuyrukta"
                    : "Taslak Kaydedildi";
            const linkDelivery = lessonNotifications.find(
              (item) => item.entity_id === l.id && ["lesson.scheduled.student", "lesson.details_updated.student"].includes(item.event_type)
            );

            return {
              type: "lesson" as const,
              group: (upcomingLessons.some((lesson) => lesson.id === l.id) ? "upcoming" : "past") as "upcoming" | "past",
              id: l.id,
              title: l.title,
              subject: l.subject,
              date: l.lesson_date,
              duration: l.duration_minutes,
              status: l.status,
              source: l,
              card: <div
                key={l.id}
                className={`rounded-xl border p-4 text-xs transition-colors ${
                  isCompleted
                    ? "border-border bg-slate-50/60"
                    : isCancelled
                    ? "border-neutral-200 bg-neutral-50 opacity-60"
                    : "border-border bg-white shadow-xs"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-ink">{l.title}</strong>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Ders
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800"
                            : isCancelled
                            ? "bg-neutral-200 text-neutral-700"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isCompleted ? "Tamamlandı" : isCancelled ? "İptal Edildi" : "Planlandı"}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {l.subject} {l.exam_code ? `· ${l.exam_code.toUpperCase()}` : ""} ·{" "}
                      {formatLessonDateTime(l.lesson_date, "tr", l.lesson_timezone || "Europe/Istanbul", l.lesson_timezone_label || "TR")}{" "}
                      · {l.duration_minutes} dk
                    </p>
                  </div>
                </div>

                {/* Live Meeting Link Section */}
                {l.live_meeting_url && (
                  <div className="mt-3 rounded-lg border border-primary/20 bg-forest/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-ink font-semibold">
                        <Video className="size-4 text-primary" />
                        <span>Canlı Ders Bağlantısı:</span>
                        <a
                          href={l.live_meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-primary underline break-all flex items-center gap-1 hover:text-forest"
                        >
                          {l.live_meeting_url}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyUrl(l.id, l.live_meeting_url!)}
                          className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] border border-border hover:bg-surface-muted cursor-pointer"
                        >
                          <Copy className="size-3" />
                          {copiedId === l.id ? "Kopyalandı!" : "Kopyala"}
                        </button>
                        <a
                          href={l.live_meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-forest"
                        >
                          <ExternalLink className="size-3" />
                          Derse Katıl
                        </a>
                      </div>
                    </div>

                    {/* Email Link Dispatch Status */}
                    <div className="mt-2.5 pt-2 border-t border-primary/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{deliveryStatusText(linkDelivery, "Bağlantı e-postası")}</span>
                      {(!linkDelivery || linkDelivery.status === "failed") && <button
                        type="button"
                        disabled={sendingEmailKey === `link-${l.id}`}
                        onClick={() => void handleSendLink(l)}
                        className="inline-flex items-center gap-1 text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        <Send className="size-3" />
                        {sendingEmailKey === `link-${l.id}`
                          ? "Gönderiliyor…"
                          : linkDelivery?.status === "failed"
                            ? "Tekrar Dene"
                            : "Linki Öğrenciye E-posta İle Gönder"}
                      </button>
                      }
                    </div>
                  </div>
                )}

                {/* Historical teacher_note is preserved but only preparation
                    notes for scheduled lessons appear in the normal UI. */}
                {isScheduled && l.teacher_note && (
                  <p className="mt-2 text-ink/75 bg-surface-muted/50 p-2 rounded">
                    <strong>Not:</strong> {l.teacher_note}
                  </p>
                )}

                {/* Actions (Only active if scheduled) */}
                {isScheduled && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setCompleteTarget(l);
                        const linkedPackageIsUsable = purchases.some(
                          (purchase) => purchase.id === l.package_purchase_id
                            && purchase.status === "active"
                            && purchase.lessons_used < purchase.lesson_count
                        );
                        setCompletionPackagePurchaseId(linkedPackageIsUsable ? l.package_purchase_id || "" : "");
                      }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Ders Yapıldı
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCancelLesson(l.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="size-3.5" />
                      İptal Et
                    </button>
                  </div>
                )}

                {/* Canonical completion report and explicit MAIL-027 dispatch. */}
                {isCompleted && (
                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">Ders Sonu Raporu</span>
                      <div className="flex items-center gap-2"><button type="button" onClick={()=>setEditCompletedTarget(l)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-surface-muted"><Pencil className="size-3"/>Düzenle</button><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        reportChangedAfterSend ? "bg-amber-100 text-amber-800" : reportWasQueued ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                      }`}>{reportStatus}</span></div>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expandedReports.has(l.id)}
                      onClick={() => setExpandedReports((current) => {
                        const next = new Set(current);
                        if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                        return next;
                      })}
                      className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-muted"
                    >
                      {expandedReports.has(l.id) ? "Detayı Kapat" : "Detayı / Raporu Aç"}
                    </button>
                    {expandedReports.has(l.id) && <>
                    <textarea
                      id={`completion-report-${l.id}`}
                      value={reportValue}
                      maxLength={10000}
                      onChange={(event) => setReportDrafts((current) => ({ ...current, [l.id]: event.target.value }))}
                      placeholder="Bugünkü derste işlenen konular, öğrencinin gelişimi ve bir sonraki derse kadar öneriler..."
                      className={`${field} min-h-32 resize-y`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">{reportValue.length} / 10000</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={Boolean(sendingEmailKey) || reportValue.trim().length < 5}
                          onClick={() => void handleSaveReport(l, false)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
                        >
                          <Save className="size-3.5" />
                          {sendingEmailKey === `save-report-${l.id}` ? "Kaydediliyor…" : "Raporu Kaydet"}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(sendingEmailKey) || reportValue.trim().length < 5 || (reportWasQueued && !reportChangedAfterSend)}
                          onClick={() => void handleSaveReport(l, true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          <Send className="size-3.5" />
                          {sendingEmailKey === `send-report-${l.id}`
                            ? "Gönderiliyor…"
                            : reportWasQueued
                              ? "Güncellenmiş Raporu Tekrar Gönder"
                              : "Raporu Kaydet ve Bildirimi Gönder"}
                        </button>
                      </div>
                    </div>
                    </>}
                  </div>
                )}
              </div>,
            } satisfies NormalizedSessionItem;
          }))}
    </div>
  );
}

function CompletedLessonEditModal({lesson,purchases,topics,instructors,onClose,onSaved}:{lesson:LessonRow;purchases:PackagePurchase[];topics:LessonReference[];instructors:InstructorReference[];onClose:()=>void;onSaved:()=>void}) {
  const local=lessonInstantToLocalInput(new Date(lesson.lesson_date),lesson.lesson_timezone || "Europe/Istanbul");
  const [form,setForm]=useState({topicId:lesson.topic_id||"",title:lesson.title||"Birebir Ders",subject:lesson.subject||"",date:local.slice(0,10),startTime:local.slice(11,16),timezoneLabel:(lesson.lesson_timezone_label||"TR") as LessonTimezoneLabel,durationMinutes:lesson.duration_minutes,instructorId:lesson.instructor_id||"",packagePurchaseId:lesson.package_purchase_id||""});
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  async function submit(event:React.FormEvent){event.preventDefault();if(!form.title.trim()||!form.subject.trim()){setError("Ders ve Konu / Alan zorunludur.");return;}setBusy(true);setError("");const zone=lessonTimezoneForLabel(form.timezoneLabel);let lessonDate:string;try{lessonDate=localLessonDateTimeToUtc(`${form.date}T${form.startTime}`,zone.timeZone);}catch(err){setBusy(false);setError(err instanceof Error?err.message:"Tarih dönüştürülemedi.");return;}const result=await updateCompletedLesson({lessonId:lesson.id,topicId:form.topicId||null,title:form.title.trim(),subject:form.subject.trim(),lessonDate,lessonTimezone:zone.timeZone,lessonTimezoneLabel:zone.label,durationMinutes:form.durationMinutes,instructorId:form.instructorId||null,packagePurchaseId:form.packagePurchaseId});setBusy(false);if(!result.success){setError(result.error||"Ders güncellenemedi.");return;}onSaved();}
  return <div className="fixed inset-0 z-[185] flex items-center justify-center overflow-y-auto bg-[#10271B]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="completed-lesson-edit-title" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><form onSubmit={submit} className="max-h-[calc(100dvh-32px)] w-full max-w-[760px] overflow-y-auto rounded-[24px] border border-[#E6E4DC] bg-white shadow-[0_24px_60px_rgba(16,39,27,0.18)]"><div className="flex items-center gap-3 border-b border-[#E6E4DC] px-6 py-5"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#F4EEDF]"><Pencil className="size-5 text-[#10271B]"/></div><div className="min-w-0 flex-1"><h3 id="completed-lesson-edit-title" className="font-heading text-[22px] font-semibold text-ink">Dersi Düzenle</h3><p className="text-[13px] text-muted-foreground">Ders hakkı, paket değiştirildiğinde paketler arasında atomik aktarılır.</p></div><button type="button" aria-label="Kapat" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#E6E4DC] hover:bg-[#F7F6F1]"><X className="size-[18px]"/></button></div><div className="space-y-4 p-6">{error&&<p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs font-semibold">Ders<select value={form.topicId} onChange={e=>{const selected=topics.find(item=>item.id===e.target.value);setForm({...form,topicId:e.target.value,title:selected?.label||form.title});}} className={field}><option value="">Diğer / özel ders adı</option>{topics.map(item=><option key={item.id} value={item.id}>{item.label}{item.active?"":" (pasif)"}</option>)}</select></label>
    <label className="text-xs font-semibold">Ders Adı<Input required placeholder="Ders adı" value={form.title} onChange={title=>setForm({...form,title})}/></label>
    <label className="text-xs font-semibold">Konu / Alan<Input required placeholder="İşlenen konu" value={form.subject} onChange={subject=>setForm({...form,subject})}/></label>
    <label className="text-xs font-semibold">Eğitmen<select value={form.instructorId} onChange={e=>setForm({...form,instructorId:e.target.value})} className={field}><option value="">Eğitmen seçilmedi</option>{instructors.map(item=><option key={item.id} value={item.id}>{item.name}{item.active?"":" (pasif)"}</option>)}</select></label>
    <label className="text-xs font-semibold">Tarih (GG.AA.YYYY)<ControlledLessonDate label="Tamamlanmış ders tarihi GG.AA.YYYY" value={form.date} onChange={date=>setForm({...form,date})}/></label>
    <label className="text-xs font-semibold">Başlangıç Saati (HH:mm)<ControlledLessonTime label="Tamamlanmış ders başlangıç saati HH:mm" value={form.startTime} onChange={startTime=>setForm({...form,startTime})}/></label>
    <label className="text-xs font-semibold">Süre (Dakika)<Input type="number" placeholder="60" value={String(form.durationMinutes)} onChange={value=>setForm({...form,durationMinutes:Number(value)||60})}/></label>
    <label className="text-xs font-semibold">Saat Dilimi<select value={form.timezoneLabel} onChange={e=>setForm({...form,timezoneLabel:e.target.value as LessonTimezoneLabel})} className={field}>{LESSON_TIMEZONES.map(zone=><option key={zone.label} value={zone.label}>{zone.display}</option>)}</select></label>
  </div><label className="block text-xs font-semibold">Ders Hakkının Düştüğü Paket<select required value={form.packagePurchaseId} onChange={e=>setForm({...form,packagePurchaseId:e.target.value})} className={field}>{purchases.filter(item=>item.id===lesson.package_purchase_id||(item.status==="active"&&item.lessons_used<item.lesson_count)||(item.status==="completed"&&item.lessons_used<item.lesson_count)).map(item=><option key={item.id} value={item.id}>{packageDisplayName(item)} ({item.lesson_count-item.lessons_used} ders kaldı)</option>)}</select></label></div><div className="flex justify-end gap-2 border-t border-[#E6E4DC] bg-[#FBFAF7] px-6 py-4"><button type="button" onClick={onClose} className="min-h-[46px] rounded-xl border border-[#D9D6CC] bg-white px-5 text-sm font-semibold">Vazgeç</button><button disabled={busy} className="min-h-[46px] rounded-xl border border-[#10271B] bg-[#10271B] px-[22px] text-sm font-bold text-white disabled:opacity-50">{busy?"Kaydediliyor…":"Kaydet"}</button></div></form></div>;
}

// Referans "Dersi Düzenle" (#ders-edit-dialog). Ders bilgileri ve paket
// aktarımı admin_update_completed_lesson_v2 ile; rapor değiştiyse mevcut rapor
// RPC'leriyle kaydedilir, anahtar açıksa rapor veliye (yeniden) gönderilir.
// "Dersi sil" yok: ders hakkı defteri (student_package_adjustments.linked_lesson_id
// on delete restrict) tamamlanmış dersin silinmesine izin vermez.
function RefCompletedLessonEditDialog({lesson,purchases,topics,instructors,studentName,notifyEmail,onManage,onClose,onSaved,children}:{lesson:LessonRow;purchases:PackagePurchase[];topics:LessonReference[];instructors:InstructorReference[];studentName:string;notifyEmail:string;onManage:(kind:"topic"|"instructor")=>void;onClose:()=>void;onSaved:()=>void;children?:ReactNode}) {
  const local=lessonInstantToLocalInput(new Date(lesson.lesson_date),lesson.lesson_timezone || "Europe/Istanbul");
  const originalReport=(lesson.completion_report||"").trim();
  const [form,setForm]=useState<RefLessonForm>({topicId:lesson.topic_id||"",subject:lesson.subject||"",instructorId:lesson.instructor_id||"",date:local.slice(0,10),startTime:local.slice(11,16),timezoneLabel:lessonTimezoneForLabel(lesson.lesson_timezone_label).label,durationMinutes:lesson.duration_minutes,packagePurchaseId:lesson.package_purchase_id||"",completionReport:lesson.completion_report||"",sendEmail:false});
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const eligible=purchases.filter(item=>item.id===lesson.package_purchase_id||((item.status==="active"||item.status==="completed")&&item.lessons_used<item.lesson_count));
  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(busy)return;
    const title=(topics.find(item=>item.id===form.topicId)?.label||lesson.title||"").trim();
    const subject=form.subject.trim();
    const report=form.completionReport.trim();
    const reportChanged=report!==originalReport;
    if(!title||!subject){setError("Ders ve Konu / Alan zorunludur.");return;}
    if((reportChanged||form.sendEmail)&&(report.length<5||report.length>10000)){setError(report.length>10000?"Ders sonu raporu 10.000 karakteri aşamaz.":"Ders sonu raporu en az 5 karakter olmalıdır.");return;}
    setBusy(true);setError("");
    const zone=lessonTimezoneForLabel(form.timezoneLabel);
    let lessonDate:string;
    try{lessonDate=localLessonDateTimeToUtc(`${form.date}T${form.startTime}`,zone.timeZone);}catch(err){setBusy(false);setError(err instanceof Error?err.message:"Tarih dönüştürülemedi.");return;}
    const result=await updateCompletedLesson({lessonId:lesson.id,topicId:form.topicId||null,title,subject,lessonDate,lessonTimezone:zone.timeZone,lessonTimezoneLabel:zone.label,durationMinutes:form.durationMinutes,instructorId:form.instructorId||null,packagePurchaseId:form.packagePurchaseId});
    if(!result.success){setBusy(false);setError(result.error||"Ders güncellenemedi.");return;}
    if(reportChanged||form.sendEmail){
      const saved=await saveLessonCompletionReport(lesson.id,report);
      if(!saved.success){setBusy(false);setError(`Ders güncellendi; rapor kaydedilemedi: ${saved.error}`);return;}
      if(form.sendEmail){
        const sent=await saveAndSendLessonReport(lesson.id,report,Boolean(lesson.report_email_sent_at));
        if(!sent.success){setBusy(false);setError(sent.error||"Rapor kaydedildi ancak e-posta gönderilemedi. Lütfen tekrar deneyin.");return;}
      }
    }
    setBusy(false);
    onSaved();
  }
  return <RefLessonDialog mode="edit" studentName={studentName} notifyEmail={notifyEmail} form={form} onChange={(patch)=>setForm(current=>({...current,...patch}))} topics={topics} instructors={instructors} purchases={eligible} lastSentAt={lesson.report_email_sent_at} customTitle={lesson.topic_id?null:lesson.title} busy={busy} error={error} onClose={onClose} onSubmit={submit} onManage={onManage}>{children}</RefLessonDialog>;
}

// ----------------------------------------------------------------------------
// HOMEWORK PANEL
// ----------------------------------------------------------------------------

function HomeworkPanel({
  homework,
  lessons,
  userId,
  studentName,
  busy: _busy,
  setBusy: _setBusy,
  setError: _setError,
  changed,
}: {
  homework: Tables<"student_homework">[];
  lessons: Tables<"student_lessons">[];
  userId: string;
  studentName: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-ink">Ödevler & Materyaller</h3>
          <p className="text-xs text-muted-foreground">
            Öğrenciye kütüphaneden içerik/ödev atayın, ders notlarını paylaşın ve teslim durumlarını izleyin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAssignOpen(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
        >
          <CalendarPlus className="size-4" /> İçerik / Ödev Ata
        </button>
      </div>
      <div className="space-y-2.5">
        {homework.length ? (
          homework.map((item) => <HomeworkReview key={item.id} item={item} changed={changed} />)
        ) : (
          <Empty>Henüz atanmış ödev veya ders materyali bulunmuyor.</Empty>
        )}
      </div>
      <AssignHomeworkModal
        isOpen={assignOpen}
        lockedStudentId={userId}
        lockedStudentName={studentName}
        lessons={lessons.map((lesson) => ({ id: lesson.id, title: lesson.title }))}
        onClose={() => setAssignOpen(false)}
        onAssigned={changed}
      />
    </div>
  );
}

function HomeworkReview({
  item,
  changed,
}: {
  item: Tables<"student_homework">;
  changed: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [subDownloading, setSubDownloading] = useState(false);

  const raw = item as unknown as Record<string, unknown>;
  const attachmentPath = raw.attachment_path as string | undefined;
  const attachmentName = (raw.attachment_name as string | undefined) || "Atama Dosyası";
  const submissionAttachmentPath = raw.submission_attachment_path as string | undefined;
  const submissionAttachmentName = (raw.submission_attachment_name as string | undefined) || "Öğrenci Ödev Dosyası";
  const fileUrl = item.assignment_file_url;

  async function handleDownloadAttachment() {
    if (!attachmentPath) return;
    try {
      setDownloading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from("homework-attachments").createSignedUrl(attachmentPath, 3600);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Download failed");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      alert("Dosya indirilemedi.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadSubmissionAttachment() {
    if (!submissionAttachmentPath) return;
    try {
      setSubDownloading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from("homework-attachments").createSignedUrl(submissionAttachmentPath, 3600);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Download failed");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      alert("Öğrenci dosyası indirilemedi.");
    } finally {
      setSubDownloading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className="text-sm font-semibold text-ink">{item.title}</strong>
          {item.due_date && (
            <p className="text-[11px] text-muted-foreground">
              Son Teslim: {new Date(item.due_date).toLocaleString("tr-TR")}
            </p>
          )}
        </div>
        <Badge>{item.status}</Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink/80 whitespace-pre-wrap">{item.description}</p>

      {/* Attachment Resource Links */}
      {(attachmentPath || fileUrl) && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-primary/20 bg-forest/5 p-2 text-xs">
          <FileText className="size-3.5 text-primary shrink-0" />
          <span className="font-semibold text-ink">Ek:</span>
          {attachmentPath ? (
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadAttachment}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
            >
              <Download className="size-3" />
              <span>{attachmentName}</span>
              {downloading && <span className="text-[10px]">(İndiriliyor...)</span>}
            </button>
          ) : fileUrl ? (
            <a
              className="inline-flex items-center gap-1 font-semibold text-primary underline"
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3" />
              <span>Bağlantıyı Aç</span>
            </a>
          ) : null}
        </div>
      )}

      {(item.submission_text || submissionAttachmentPath) && (
        <div className="mt-3 rounded-lg border border-border bg-white p-3 text-xs space-y-2">
          <strong className="text-ink font-semibold block">Öğrenci Yanıtı / Teslimi:</strong>
          {item.submission_text && <p className="whitespace-pre-wrap text-ink/80">{item.submission_text}</p>}
          {submissionAttachmentPath && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <FileText className="size-3.5 text-emerald-700" />
              <span className="font-semibold text-ink">Teslim Edilen Dosya:</span>
              <button
                type="button"
                disabled={subDownloading}
                onClick={handleDownloadSubmissionAttachment}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3" />
                <span>{submissionAttachmentName}</span>
                {subDownloading && <span className="text-[10px]">(İndiriliyor...)</span>}
              </button>
            </div>
          )}
          {item.submitted_at && (
            <p className="text-[10px] text-muted-foreground">
              Teslim Tarihi: {new Date(item.submitted_at).toLocaleString("tr-TR")}
            </p>
          )}
        </div>
      )}

      <HomeworkSubmissionReview homeworkId={item.id} onChanged={changed} />
    </Card>
  );
}

function formatPaymentStatus(status: string | null | undefined): string {
  if (!status) return "Belirtilmemiş";
  const s = status.toLowerCase();
  if (s === "paid") return "Ödendi";
  if (s === "pending") return "Ödeme Bekliyor";
  if (s === "waived") return "Ücret Muafiyeti / Ücretsiz";
  if (s === "bank_transfer_pending") return "Havale Onayı Bekliyor";
  if (s === "processing") return "İşleniyor";
  if (s === "requires_action") return "İşlem Bekliyor";
  if (s === "failed") return "Başarısız";
  if (s === "cancelled") return "İptal Edildi";
  if (s === "refunded") return "İade Edildi";
  return status;
}

// ----------------------------------------------------------------------------
// PACKAGE PANEL
// ----------------------------------------------------------------------------

function PackagePanel({
  purchases,
  payments,
  packages,
  adjustments,
  rightsNotification,
  userId,
  busy,
  setBusy,
  setError,
  changed,
  actionRequest,
  referenceMode,
  notifyEmail,
}: {
  purchases: PackagePurchase[];
  payments: StudentPayment[];
  packages: PackageOption[];
  adjustments: PackageAdjustment[];
  rightsNotification: LessonNotificationState | null;
  userId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
  actionRequest?: { type: "add_lesson" | "add_package" | "add_note"; nonce: number } | null;
  referenceMode: boolean;
  notifyEmail: string;
}) {
  const toast = useToast();
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const today = localDayKey(new Date());
  const [hakError, setHakError] = useState("");
  const [pkError, setPkError] = useState("");
  const [activeModal, setActiveModal] = useState<"none" | "assign_package" | "adjust_lessons">("none");
  useEffect(() => {
    if (!referenceMode || activeModal === "none" || busy) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveModal("none"); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [activeModal, busy, referenceMode]);
  // Manuel bilgilendirme e-postaları: her buton yalnız kendi yüklenme durumunu
  // kullanır, sayfa yenilenmez ve panel kapanmaz.
  const [mailSendingKey, setMailSendingKey] = useState<string | null>(null);
  const [mailSentKeys, setMailSentKeys] = useState<Set<string>>(new Set());
  const [rightsMailStatus, setRightsMailStatus] = useState<"idle" | "loading" | "pending" | "failed">("idle");
  const effectiveRightsMailStatus = rightsMailStatus !== "idle" ? rightsMailStatus : rightsNotification?.status || "idle";

  useEffect(() => {
    if (actionRequest?.type !== "add_package") return;
    const timer = window.setTimeout(() => { setPkError(""); setActiveModal("assign_package"); }, 0);
    return () => window.clearTimeout(timer);
  }, [actionRequest?.nonce, actionRequest?.type]);

  async function reviewRightsMail() {
    setRightsMailStatus("loading");
    const context = await getPackageRightsNotificationContext(userId);
    if (!context.data) {
      setRightsMailStatus("failed");
      toast.error(context.error || "Alıcı bilgisi alınamadı.");
      return;
    }
    setRightsMailStatus("idle");
    requestConfirmation({
      title: "Hak Bilgisi E-postası Gönder",
      description: `Alıcı: ${context.data.recipient} · Toplam kalan hak: ${context.data.total_remaining_lessons} · Aktif paketler: ${context.data.packages.map((item) => item.name).join(" · ") || "Yok"}`,
      confirmLabel: "Kuyruğa Al",
      action: async () => {
        setRightsMailStatus("loading");
        const result = await sendPackageRightsNotification(userId, crypto.randomUUID());
        setRightsMailStatus(result.success ? "pending" : "failed");
        if (result.success) toast.success("Hak bilgisi e-postası gönderim kuyruğuna alındı.");
        else toast.error(result.error || "E-posta kuyruğa alınamadı.");
        if (result.success) changed();
      },
    });
  }

  async function sendPackageMail(purchaseId: string, kind: "package_assigned" | "lesson_rights") {
    const key = `${purchaseId}:${kind}`;
    if (mailSendingKey === key) return;
    setMailSendingKey(key);
    setError("");
    const res = await sendPackageNotificationEmail(purchaseId, kind);
    setMailSendingKey(null);
    if (!res.success) {
      toast.error(res.error || "Bilgilendirme e-postası gönderilemedi.");
      return;
    }
    const isResend = mailSentKeys.has(key);
    setMailSentKeys((prev) => new Set(prev).add(key));
    toast.success(
      kind === "package_assigned"
        ? (isResend ? "Paket bilgilendirme e-postası tekrar gönderildi." : "Paket bilgilendirme e-postası gönderildi.")
        : (isResend ? "Ders hakkı güncelleme e-postası tekrar gönderildi." : "Ders hakkı güncelleme e-postası gönderildi.")
    );
  }

  function mailButtonLabel(purchaseId: string, kind: "package_assigned" | "lesson_rights") {
    const key = `${purchaseId}:${kind}`;
    const base = kind === "package_assigned" ? "Paket Bilgilendirme E-postası" : "Ders Hakkı Güncelleme E-postası";
    if (mailSendingKey === key) return "Gönderiliyor…";
    return mailSentKeys.has(key) ? `${base}nı Tekrar Gönder` : `${base} Gönder`;
  }
  const [targetPurchaseId, setTargetPurchaseId] = useState<string>("");
  const [adjustmentMode, setAdjustmentMode] = useState<"add" | "remove">("add");

  // Assign Package Form State
  const [assignMode, setAssignMode] = useState<"catalog" | "custom">("catalog");
  const [packageForm, setPackageForm] = useState({
    packageId: "",
    customName: "",
    startDate: today,
    endDate: "",
    lessonCount: "10",
    price: "27000",
    currency: "TRY",
    paymentStatus: "paid" as "pending" | "paid" | "waived",
    adminNotes: "",
    sendNotification: false,
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    purchaseId: "",
    amount: "1",
    reason: "",
    notes: "",
    sendNotification: false,
  });

  const defaultPurchase = purchases.find((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0) || purchases[0];
  const activePurchases = purchases.filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0);
  const selectedAdjustmentPurchase = purchases.find((p) => p.id === (adjustmentForm.purchaseId || targetPurchaseId)) || defaultPurchase;
  const adjustmentAmount = Math.max(0, Number(adjustmentForm.amount) || 0);
  const signedAdjustment = adjustmentMode === "add" ? adjustmentAmount : -adjustmentAmount;
  const adjustmentPreview = previewLessonAdjustment(
    selectedAdjustmentPurchase?.lesson_count || 0,
    selectedAdjustmentPurchase?.lessons_used || 0,
    signedAdjustment
  );
  const resultingLessonCount = adjustmentPreview.newLessonCount;
  const resultingRemaining = adjustmentPreview.newRemaining;

  function openAssignModal() {
    setPkError("");
    setActiveModal("assign_package");
  }

  function openAdjustmentModal(purchaseId: string, mode: "add" | "remove") {
    const pId = purchaseId || defaultPurchase?.id || "";
    setTargetPurchaseId(pId);
    setAdjustmentMode(mode);
    setAdjustmentForm((prev) => ({
      ...prev,
      purchaseId: pId,
      amount: "1",
      reason: "",
      notes: "",
    }));
    setHakError("");
    setActiveModal("adjust_lessons");
  }

  function chooseCatalogPackage(id: string) {
    const p = packages.find((x) => x.id === id);
    setPackageForm({
      ...packageForm,
      packageId: id,
      customName: "",
      lessonCount: String(p?.lesson_count || "1"),
      price: String(p?.current_total ?? p?.price_amount ?? "0"),
      currency: p?.currency || "TRY",
    });
  }

  async function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const isCustom = assignMode === "custom";
    const res = await assignStudentPackage({
      studentId: userId,
      packageId: isCustom ? "custom" : packageForm.packageId,
      customPackageName: isCustom ? packageForm.customName.trim() : null,
      startDate: packageForm.startDate,
      endDate: packageForm.endDate || null,
      lessonCount: Number(packageForm.lessonCount),
      priceAmount: Number(packageForm.price || 0),
      currency: "TRY",
      paymentStatus: packageForm.paymentStatus,
      adminNotes: packageForm.adminNotes.trim() || null,
    });
    let notificationFailed = false;
    if (res.success && packageForm.sendNotification && res.purchaseId) {
      const mail = await sendPackageNotificationEmail(res.purchaseId, "package_assigned");
      notificationFailed = !mail.success;
    }
    setBusy(false);
    if (res.error) {
      if (referenceMode) setPkError(res.error);
      else setError(res.error);
    } else {
      setActiveModal("none");
      changed();
      toast.success(notificationFailed
        ? "Paket tanımlandı; ancak bilgilendirme e-postası gönderilemedi. Paket kartından tekrar deneyebilirsiniz."
        : `Paket başarıyla tanımlandı${packageForm.sendNotification ? " ve bilgilendirme e-postası gönderildi" : ""}.`);
    }
  }

  async function handleAdjustmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAdjustmentPurchase) return;
    if (adjustmentAmount < 1 || adjustmentAmount > 100) {
      setError("Ders hakkı değişikliği 1 ile 100 arasında olmalıdır.");
      return;
    }
    if (adjustmentForm.reason.trim().length < 3) {
      setError("En az 3 karakterlik bir gerekçe girin.");
      return;
    }
    if (resultingRemaining < 0) {
      setError("Kalan ders hakkından daha fazla ders azaltılamaz.");
      return;
    }
    setBusy(true);
    const res = await adjustStudentPackageLessons({
      purchaseId: selectedAdjustmentPurchase.id,
      lessonDelta: signedAdjustment,
      reason: adjustmentForm.reason.trim(),
      notes: adjustmentForm.notes.trim() || null,
    });
    let notificationFailed = false;
    if (res.success && adjustmentForm.sendNotification) {
      const mail = await sendPackageNotificationEmail(selectedAdjustmentPurchase.id, "lesson_rights");
      notificationFailed = !mail.success;
    }
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      setActiveModal("none");
      changed();
      const remaining = typeof res.newRemaining === "number" ? res.newRemaining : resultingRemaining;
      toast.success(notificationFailed ? "Ders hakkı güncellendi; ancak bilgilendirme e-postası gönderilemedi." :
        adjustmentMode === "add"
          ? `Ders hakkı ${adjustmentAmount} adet artırıldı. Yeni kalan hak: ${remaining}.`
          : `Ders hakkı ${adjustmentAmount} adet azaltıldı. Yeni kalan hak: ${remaining}.`
      );
    }
  }

  // Referans "Ders Hakkı Ekle": Açıklama isteğe bağlı; sunucunun zorunlu
  // nedeni lessonRightsReasonFromNote ile üretilir. Aynı RPC ve aynı açık
  // e-posta aksiyonu kullanılır.
  async function handleRefHakSubmit(request: { amount: number; note: string; sendNotification: boolean }) {
    if (!selectedAdjustmentPurchase || busy) return;
    if (!Number.isInteger(request.amount) || request.amount < 1 || request.amount > 100) {
      setHakError("Ders hakkı değişikliği 1 ile 100 arasında olmalıdır.");
      return;
    }
    const { reason, notes } = lessonRightsReasonFromNote(request.note);
    setBusy(true);
    setHakError("");
    const res = await adjustStudentPackageLessons({
      purchaseId: selectedAdjustmentPurchase.id,
      lessonDelta: request.amount,
      reason,
      notes,
    });
    let notificationFailed = false;
    if (res.success && request.sendNotification) {
      const mail = await sendPackageNotificationEmail(selectedAdjustmentPurchase.id, "lesson_rights");
      notificationFailed = !mail.success;
    }
    setBusy(false);
    if (res.error) {
      setHakError(res.error);
      return;
    }
    setActiveModal("none");
    changed();
    const remaining = typeof res.newRemaining === "number" ? res.newRemaining : selectedAdjustmentPurchase.lesson_count - selectedAdjustmentPurchase.lessons_used + request.amount;
    toast.success(notificationFailed
      ? "Ders hakkı güncellendi; ancak bilgilendirme e-postası gönderilemedi."
      : `Ders hakkı ${request.amount} adet artırıldı. Yeni kalan hak: ${remaining}.`);
  }

  return (
    <div className={referenceMode ? "space-y-6" : "space-y-5"}>
      {confirmationDialog}
      {/* Top Header: Single [ Yeni Paket Tanımla ] CTA */}
      <div className={`flex flex-wrap items-center justify-between gap-5 border bg-white ${referenceMode ? "rounded-[20px] border-[#E6E4DC] p-6" : "rounded-2xl border-border p-4"}`}>
        <div>
          <h3 className={`font-heading font-semibold text-[#1C231E] ${referenceMode ? "text-2xl" : "text-lg"}`}>Eğitim Paketleri & Ders Hakları</h3>
          {!referenceMode && <p className="text-xs text-muted-foreground">
            Öğrencinin kayıtlı paketlerini yönetin, yeni paket tanımlayın veya aktif paketlere ek ders ekleyin.
          </p>}
        </div>
        <div className="flex flex-wrap gap-2">{!referenceMode && <button
          type="button"
          disabled={rightsMailStatus === "loading"}
          onClick={() => void reviewRightsMail()}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
        >
          <Mail className="size-3.5" />
          {rightsMailStatus === "loading" ? "Hazırlanıyor…" : "Hak Bilgisi E-postası Gönder"}
        </button>}<button
          type="button"
          onClick={openAssignModal}
          className={`inline-flex items-center gap-2 rounded-xl px-4 font-semibold text-white cursor-pointer transition-colors shadow-xs ${referenceMode ? "min-h-11 bg-[#1D1E1B] pl-2.5 text-sm font-bold shadow-[0_6px_16px_rgba(20,20,18,0.18)] hover:bg-[#30312C]" : "min-h-9 bg-[#10271B] text-xs hover:bg-[#1E3D2B]"}`}
        >
          {referenceMode
            ? <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#D9AE57]/25 text-[#D9AE57]" aria-hidden="true"><Package className="size-3.5" /></span>
            : <PackagePlus className="size-3.5" />}
          Yeni Paket Tanımla
        </button>
        </div>
      </div>
      {effectiveRightsMailStatus === "sent" ? <p className="text-xs font-medium text-emerald-800">Hak bilgisi e-postası gönderildi{rightsNotification?.sent_at ? ` · ${new Date(rightsNotification.sent_at).toLocaleString("tr-TR")}` : ""}.</p> : ["pending", "processing"].includes(effectiveRightsMailStatus) ? <p className="text-xs font-medium text-amber-800">Hak bilgisi e-postası bekliyor / gönderim sırasında.</p> : effectiveRightsMailStatus === "failed" ? <p className="text-xs font-medium text-red-700">Hak bilgisi e-postası gönderilemedi; kontrollü olarak tekrar deneyebilirsiniz.</p> : null}

      {/* COÖRDINATED IN-PLACE ACTION VIEW: Paket Tanımla */}
      {activeModal === "assign_package" && referenceMode && (
        <RefPkDialog
          packages={packages.filter((p) => p.id !== "custom" && (p.lesson_count || 0) > 0 && !p.name_tr?.toLowerCase().includes("özel"))}
          form={packageForm}
          onChoosePackage={chooseCatalogPackage}
          onChange={(patch) => setPackageForm((current) => ({ ...current, ...patch }))}
          notifyEmail={notifyEmail}
          busy={busy}
          error={pkError}
          onClose={() => setActiveModal("none")}
          onSubmit={handleAssignSubmit}
        />
      )}
      {activeModal === "assign_package" && !referenceMode && (
        <div className={referenceMode ? "fixed inset-0 z-[170] flex items-center justify-center overflow-y-auto bg-[#10271B]/55 p-4" : ""} role={referenceMode ? "dialog" : undefined} aria-modal={referenceMode ? "true" : undefined} aria-labelledby={referenceMode ? "assign-package-title" : undefined} onMouseDown={referenceMode ? (event) => { if (event.target === event.currentTarget) setActiveModal("none"); } : undefined}>
        <div className={`border bg-white p-6 space-y-4 animate-in fade-in duration-150 ${referenceMode ? "max-h-[calc(100dvh-32px)] w-full max-w-[640px] overflow-y-auto rounded-[24px] border-[#E6E4DC] shadow-[0_24px_60px_rgba(16,39,27,0.18)]" : "rounded-3xl border-primary/30 shadow-md"}`}>
          <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 id="assign-package-title" className="flex items-center gap-2 font-heading text-[22px] font-semibold text-ink">
                <PackagePlus className="size-4 text-primary" />
                Yeni Paket Tanımla
              </h4>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setActiveModal("none")}
                className="rounded-xl border border-border p-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Mode Switcher */}
              <div className={referenceMode ? "hidden" : "flex gap-2"}>
                <button
                  type="button"
                  onClick={() => setAssignMode("catalog")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                    assignMode === "catalog"
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                  }`}
                >
                  Katalog Paketi (Standart)
                </button>
              </div>

              {assignMode === "catalog" ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-ink">Paket seçin <span className="text-[#9A3324]">*</span></label>
                      <select required value={packageForm.packageId} onChange={(e) => chooseCatalogPackage(e.target.value)} className={field}>
                        <option value="">Seçiniz...</option>
                        {packages.filter((p) => p.id !== "custom" && [1, 5, 10, 20, 30].includes(p.lesson_count || 0) && !p.name_tr?.toLowerCase().includes("özel")).map((p) => <option key={p.id} value={p.id}>{packageDisplayName(p.lesson_count)} ({money(Number(p.current_total ?? p.price_amount ?? 0), "TRY")})</option>)}
                      </select>
                  </div>

                  {!referenceMode && packageForm.packageId && (
                    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-forest/5 p-3.5 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Seçilen Paket Özeti</span>
                        <strong className="text-sm font-bold text-ink">
                          {packageDisplayName(Number(packageForm.lessonCount))}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Sabit Tutar</span>
                        <strong className="text-sm font-bold text-primary">
                          {money(Number(packageForm.price || 0), "TRY")}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-ink">Ödeme durumu</label>
                    <select value={packageForm.paymentStatus} onChange={(e) => setPackageForm({ ...packageForm, paymentStatus: e.target.value as "pending" | "paid" | "waived" })} className={field}><option value="paid">Ödendi (Onaylı)</option><option value="waived">Ücret Muafiyeti / Ücretsiz Tanımlandı</option></select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Yönetici Notu / Tanımı</label>
                    <input
                      required
                      type="text"
                      placeholder="örn. Hızlandırılmış AP Calculus"
                      value={packageForm.customName}
                      onChange={(e) => setPackageForm({ ...packageForm, customName: e.target.value })}
                      className={field}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Toplam Ders Sayısı</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="500"
                        value={packageForm.lessonCount}
                        onChange={(e) => setPackageForm({ ...packageForm, lessonCount: e.target.value })}
                        className={field}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Ücret (TL)</label>
                      <TrNumberInput
                        required
                        value={packageForm.price}
                        onValueChange={(value) => setPackageForm({ ...packageForm, price: value })}
                        className={field}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Ödeme Durumu</label>
                    <select
                      value={packageForm.paymentStatus}
                      onChange={(e) => setPackageForm({ ...packageForm, paymentStatus: e.target.value as "pending" | "paid" | "waived" })}
                      className={field}
                    >
                      <option value="paid">Ödendi (Onaylı)</option>
                      <option value="pending">Ödeme Bekliyor</option>
                      <option value="waived">Ücret Muafiyeti / Ücretsiz Tanımlandı</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Yönetici Notu (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="İç referans veya açıklama notu"
                  value={packageForm.adminNotes}
                  onChange={(e) => setPackageForm({ ...packageForm, adminNotes: e.target.value })}
                  className={field}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] leading-relaxed text-ink">
                <input type="checkbox" checked={packageForm.sendNotification} onChange={(event) => setPackageForm({ ...packageForm, sendNotification: event.target.checked })} className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary" />
                <span><strong>Paket tanımlama e-postası gönder</strong><br />Yalnızca bu kutu işaretlenirse hesap sahibine paket bilgisi gönderilir. Varsayılan kapalıdır.</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveModal("none")}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={busy || (assignMode === "catalog" && !packageForm.packageId) || (assignMode === "custom" && !packageForm.customName.trim())}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
                >
                  <Check className="size-3.5" />
                  {busy ? "Kaydediliyor..." : "Paketi Tanımla"}
                </button>
              </div>
            </form>
        </div>
        </div>
      )}

      {/* COÖRDINATED IN-PLACE ACTION VIEW: Ders hakkı ekle / azalt */}
      {activeModal === "adjust_lessons" && selectedAdjustmentPurchase && referenceMode && adjustmentMode === "add" && (
        <RefHakDialog
          purchase={selectedAdjustmentPurchase}
          notifyEmail={notifyEmail}
          busy={busy}
          error={hakError}
          onClose={() => setActiveModal("none")}
          onSubmit={(request) => void handleRefHakSubmit(request)}
        />
      )}
      {activeModal === "adjust_lessons" && selectedAdjustmentPurchase && !(referenceMode && adjustmentMode === "add") && (
        <div className={referenceMode ? "fixed inset-0 z-[170] flex items-center justify-center overflow-y-auto bg-[#10271B]/55 p-4" : ""} role={referenceMode ? "dialog" : undefined} aria-modal={referenceMode ? "true" : undefined} aria-labelledby={referenceMode ? "adjust-lessons-title" : undefined} onMouseDown={referenceMode ? (event) => { if (event.target === event.currentTarget) setActiveModal("none"); } : undefined}>
        <div className={`border bg-white p-6 space-y-4 animate-in fade-in duration-150 ${referenceMode ? "max-h-[calc(100dvh-32px)] w-full max-w-[600px] overflow-y-auto rounded-[24px] border-[#E6E4DC] shadow-[0_24px_60px_rgba(16,39,27,0.18)]" : "rounded-3xl border-primary/30 shadow-md"}`}>
          <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 id="adjust-lessons-title" className="flex items-center gap-2 font-heading text-[22px] font-semibold text-ink">
                {adjustmentMode === "add" ? <Plus className="size-4 text-emerald-700" /> : <Minus className="size-4 text-rose-700" />}
                {adjustmentMode === "add" ? "Ders Hakkı Ekle" : "Paket Hakkı Düzeltmesi"}
              </h4>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setActiveModal("none")}
                className="rounded-xl border border-border p-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              {purchases.length > 1 && (
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Hedef Paket</label>
                  <select
                    value={adjustmentForm.purchaseId || selectedAdjustmentPurchase.id}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, purchaseId: e.target.value })}
                    className={field}
                  >
                    {purchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {packageDisplayName(p)} ({p.lessons_used}/{p.lesson_count} Ders · {p.status === "active" ? "Aktif" : p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Current Balance Banner */}
              <div className="rounded-xl border border-border bg-surface-muted/70 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between font-semibold text-ink">
                  <span>Mevcut Paket:</span>
                  <span>{packageDisplayName(selectedAdjustmentPurchase)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ders Durumu:</span>
                  <span>
                    {selectedAdjustmentPurchase.lesson_count} toplam · {selectedAdjustmentPurchase.lessons_used} kullanılan ·{" "}
                    <strong className="text-emerald-700">{Math.max(0, selectedAdjustmentPurchase.lesson_count - selectedAdjustmentPurchase.lessons_used)} kalan</strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Değişiklik Miktarı</label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAdjustmentForm({ ...adjustmentForm, amount: String(num) })}
                      className={`rounded-xl border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        adjustmentForm.amount === String(num)
                          ? "border-primary bg-primary text-white shadow-xs"
                          : "border-border bg-surface hover:bg-surface-muted text-ink"
                      }`}
                    >
                      {adjustmentMode === "add" ? "+" : "−"}{num} Ders
                    </button>
                  ))}
                </div>
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Ders adedi"
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                  className={field}
                />
              </div>

              {adjustmentAmount > 0 && (
                <div className={`rounded-2xl border p-3.5 text-xs space-y-1 ${resultingRemaining < 0 ? "border-rose-200 bg-rose-50 text-rose-950" : "border-emerald-200 bg-emerald-50/70 text-emerald-950"}`}>
                  <p className="font-bold flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-700" />
                    İşlem Sonrası Hak Özeti
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-semibold">
                    <div className="rounded-xl bg-white/80 p-2 border border-emerald-200">
                      <span className="block text-[10px] text-muted-foreground">Yeni Toplam</span>
                      <span className="text-sm font-bold text-ink">
                        {resultingLessonCount} ders
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/80 p-2 border border-emerald-200">
                      <span className="block text-[10px] text-muted-foreground">Kullanılan (Sabit)</span>
                      <span className="text-sm font-bold text-ink">{selectedAdjustmentPurchase.lessons_used} ders</span>
                    </div>
                    <div className="rounded-xl bg-emerald-100 p-2 border border-emerald-300">
                      <span className="block text-[10px] text-emerald-800">Yeni Kalan</span>
                      <span className="text-sm font-bold text-emerald-900">
                        {resultingRemaining} ders
                      </span>
                    </div>
                  </div>
                  {resultingRemaining < 0 && <p className="mt-2 font-semibold">Kalan haktan daha fazla ders azaltılamaz.</p>}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Gerekçe</label>
                <input
                  required
                  type="text"
                  minLength={3}
                  maxLength={200}
                  placeholder="örn. Yönetim onaylı ders hakkı düzeltmesi"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className={field}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Yönetici Notu (Opsiyonel)</label>
                <textarea maxLength={1000} rows={3} value={adjustmentForm.notes} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })} className={field} />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] leading-relaxed text-ink">
                <input type="checkbox" checked={adjustmentForm.sendNotification} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, sendNotification: event.target.checked })} className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary" />
                <span><strong>Ders hakkı güncelleme e-postası gönder</strong><br />E-postada yalnızca öğrencinin tüm aktif paketlerindeki toplam kalan ders hakkı belirtilir.</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveModal("none")}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={busy || adjustmentAmount < 1 || adjustmentAmount > 100 || adjustmentForm.reason.trim().length < 3 || resultingRemaining < 0}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer ${adjustmentMode === "add" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-700 hover:bg-rose-800"}`}
                >
                  {adjustmentMode === "add" ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                  {busy ? "Kaydediliyor..." : adjustmentMode === "add" ? "Ders Hakkını Ekle" : "Paketi Güncelle"}
                </button>
              </div>
            </form>
        </div>
        </div>
      )}

      {/* AGGREGATE ENTITLEMENT SUMMARY CARDS */}
      {(referenceMode || purchases.length > 0) && (
        <div className="grid grid-cols-3 gap-3 max-[560px]:gap-2">
          <div className={`rounded-2xl border ${referenceMode ? "border-[#E6E4DC] bg-white px-5 py-[18px] text-left" : "border-border bg-surface-muted/60 p-3 text-center"}`}>
            <span className={`block font-semibold text-[#5B635C] ${referenceMode ? "text-[13px]" : "text-[11px] uppercase tracking-wider"}`}>
              Toplam Tanımlanan
            </span>
            <span className={`mt-2 block font-heading font-semibold text-[#1C231E] ${referenceMode ? "text-[40px] leading-none" : "text-2xl font-bold"}`}>
              {activePurchases.reduce((s, p) => s + (p.lesson_count || 0), 0)} <span className="font-sans text-sm font-normal text-[#5B635C]">ders</span>
            </span>
          </div>
          <div className={`rounded-2xl border ${referenceMode ? "border-[#E6E4DC] bg-white px-5 py-[18px] text-left" : "border-border bg-surface-muted/60 p-3 text-center"}`}>
            <span className={`block font-semibold text-[#5B635C] ${referenceMode ? "text-[13px]" : "text-[11px] uppercase tracking-wider"}`}>
              Toplam Kullanılan
            </span>
            <span className={`mt-2 block font-heading font-semibold text-[#1C231E] ${referenceMode ? "text-[40px] leading-none" : "text-2xl font-bold"}`}>
              {activePurchases.reduce((s, p) => s + (p.lessons_used || 0), 0)} <span className="font-sans text-sm font-normal text-[#5B635C]">ders</span>
            </span>
          </div>
          <div className={`rounded-2xl border ${referenceMode ? "border-[#E6D3A8] bg-[#F6EFDD] px-5 py-[18px] text-left" : "border-primary/30 bg-primary/5 p-3 text-center"}`}>
            <span className={`block font-semibold ${referenceMode ? "text-[13px] text-[#7A5A1A]" : "text-[11px] uppercase tracking-wider text-primary"}`}>
              Toplam Kalan
            </span>
            <span className={`mt-2 block font-heading font-semibold text-[#10271B] ${referenceMode ? "text-[40px] leading-none" : "text-2xl font-bold"}`}>
              {activePurchases.reduce((s, p) => s + Math.max(0, p.lesson_count - p.lessons_used), 0)}{" "}
              <span className="font-sans text-sm font-normal text-[#7A5A1A]">ders</span>
            </span>
          </div>
        </div>
      )}

      {/* 1. AKTİF PAKETLER */}
      <section className={referenceMode ? "overflow-hidden rounded-[20px] border border-[#E6E4DC] bg-white" : "space-y-3"}>
        <div className={referenceMode ? "flex items-center gap-2.5 border-b border-[#E6E4DC] px-6 py-5" : "flex items-center justify-between"}>
          <h4 className={`font-heading font-semibold text-[#1C231E] ${referenceMode ? "text-[22px]" : "text-sm font-bold uppercase tracking-wider"}`}>
            Aktif Paketler{!referenceMode ? ` (${purchases.filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0).length})` : ""}
          </h4>
          {referenceMode && <span className="rounded-full bg-[#F0EFE9] px-2.5 py-0.5 text-[13px] font-bold text-[#4A524B]">{purchases.filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0).length}</span>}
        </div>
        {purchases.filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0).length > 0 ? (
          purchases
            .filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0)
            .map((p) => {
              const pkgAdjustments = adjustments.filter((a) => a.package_purchase_id === p.id);
              const extraLessonsSum = pkgAdjustments
                .filter((a) => a.adjustment_type === "extra_lessons")
                .reduce((sum, a) => sum + (a.lesson_delta || 0), 0);
              const baseLessonCount = Math.max(0, p.lesson_count - extraLessonsSum);
              const remaining = Math.max(0, p.lesson_count - p.lessons_used);
              const pct = Math.min(100, p.lesson_count ? Math.round((p.lessons_used / p.lesson_count) * 100) : 0);
              const title = packageDisplayName(p);

              return (
                <div key={p.id} className={`bg-white text-xs ${referenceMode ? "space-y-5 border-b border-[#E6E4DC] p-6 last:border-b-0" : "space-y-3.5 rounded-2xl border border-border p-4 shadow-xs"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-heading font-semibold text-[#1C231E] ${referenceMode ? "text-[22px]" : "text-sm font-bold"}`}>{title}</h4>
                        {referenceMode && <span className="rounded-md bg-[#E4ECE5] px-2 py-0.5 text-xs font-semibold text-[#1E3D2B]">Aktif</span>}
                        {!referenceMode && extraLessonsSum > 0 && (
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            +{extraLessonsSum} Ek Ders
                          </span>
                        )}
                      </div>
                      {!referenceMode && <p className="mt-1 text-[11px] text-[#5B635C]">
                        {p.start_date}
                        {p.end_date ? ` — ${p.end_date}` : " (Süresiz)"}
                        {p.price_amount !== null ? ` · ${money(p.price_amount, p.currency)}` : ""}
                      </p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!referenceMode && <span className="rounded-full bg-[#E4ECE5] px-2.5 py-0.5 text-[11px] font-bold text-[#1E3D2B]">
                        Aktif
                      </span>}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAdjustmentModal(p.id, "add")}
                          className={`inline-flex items-center gap-1.5 rounded-xl border font-semibold cursor-pointer transition-colors ${referenceMode ? "min-h-10 border-[#10271B] bg-white px-3.5 text-[13px] text-[#10271B] hover:bg-[#F7F6F1]" : "border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 hover:bg-emerald-100"}`}
                        >
                          <Plus className="size-3" />
                          Ders Hakkı Ekle
                        </button>
                        {/* Manuel bilgilendirme: paket tanımlama ve hak
                            değişikliği kendi başına e-posta göndermez. */}
                        {!referenceMode && <button
                          type="button"
                          disabled={mailSendingKey === `${p.id}:package_assigned`}
                          onClick={() => void sendPackageMail(p.id, "package_assigned")}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <Mail className="size-3 text-primary" />
                          {mailButtonLabel(p.id, "package_assigned")}
                        </button>}
                        {!referenceMode && <button
                          type="button"
                          disabled={mailSendingKey === `${p.id}:lesson_rights`}
                          onClick={() => void sendPackageMail(p.id, "lesson_rights")}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <Mail className="size-3 text-primary" />
                          {mailButtonLabel(p.id, "lesson_rights")}
                        </button>}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Entitlement Details */}
                  <div className="space-y-2.5">
                    <div className={`flex justify-between ${referenceMode ? "text-sm" : "text-[11px]"}`}>
                      <span className="text-[#5B635C]">
                        Kullanılan <strong className="text-[#1C231E]">{p.lessons_used} / {p.lesson_count}</strong> ders{!referenceMode ? ` (${pct}%)` : ""}
                      </span>
                      <span className="font-bold text-[#1E3D2B]">
                        {remaining} ders kaldı
                      </span>
                    </div>
                    {referenceMode ? (
                      // Tek parça çizgi: dolu kısım kullanılan ders oranı (30 dersten 1 kullanıldı → %3,3) — PDF-21.
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E6E4DC]" role="progressbar" aria-label="Kullanılan ders" aria-valuemin={0} aria-valuemax={p.lesson_count} aria-valuenow={Math.min(p.lessons_used, p.lesson_count)} aria-valuetext={`${p.lesson_count} dersten ${p.lessons_used} ders kullanıldı`} data-package-bar="">
                        <div className="h-full rounded-full bg-[#B08A3E] transition-[width] duration-300" style={{ width: `${p.lesson_count ? Math.min(100, (p.lessons_used / p.lesson_count) * 100) : 0}%` }} />
                      </div>
                    ) : (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {extraLessonsSum > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Baz Paket: <strong>{baseLessonCount} ders</strong> · Ek Dersler: <strong>+{extraLessonsSum} ders</strong> · Toplam Hak: <strong>{p.lesson_count} ders</strong>
                      </p>
                    )}
                  </div>

                  {/* Info Badges */}
                  <div className={`flex flex-wrap items-center gap-5 border-t border-[#E6E4DC] pt-4 text-[#5B635C] ${referenceMode ? "text-sm" : "text-[11px]"}`}>
                    <span>Ödeme: <strong className="text-[#1E3D2B]">{formatPaymentStatus(p.payment_status)}</strong></span>
                    {referenceMode ? (() => {
                      const linkedPayment = payments.find((payment) => payment.id === p.payment_transaction_id);
                      return (
                        <>
                          <span>Ödeme şekli: <strong className="text-[#1C231E]">{linkedPayment ? paymentMethodLabel(linkedPayment.payment_method) : p.assignment_source === "admin_manual" ? "Yönetici tanımlı" : "—"}</strong></span>
                          <span>Alındı: <strong className="text-[#1C231E]">{longDate(linkedPayment?.paid_at || p.created_at)}</strong></span>
                        </>
                      );
                    })() : <span>Kaynak: <strong className="text-[#1C231E]">{p.assignment_source === "admin_manual" ? "Yönetici Tanımlı" : "Satın Alma"}</strong></span>}
                    {!referenceMode && p.admin_notes && (
                      <>
                        <span>·</span>
                        <span className="italic text-ink/80">Not: {p.admin_notes}</span>
                      </>
                    )}
                  </div>

                  {/* Adjustment History Timeline — referans görünümde gösterilmez (PDF-21). */}
                  {!referenceMode && pkgAdjustments.length > 0 && (
                    <div className={`mt-2 rounded-[14px] bg-[#F7F6F1] p-4 text-[13px] ${referenceMode ? "space-y-2" : "space-y-2 border border-[#E6E4DC]"}`}>
                      <div className="flex items-center gap-1.5 font-bold text-ink">
                        <History className="size-3.5 text-primary" />
                        <span>{referenceMode ? "Paket geçmişi" : "Paket Düzeltme & Ek Ders Geçmişi"}</span>
                      </div>
                      <ul className="space-y-1.5 pl-2">
                        {pkgAdjustments.map((adj, adjustmentIndex) => (
                          <li key={adj.id} className={`flex flex-wrap items-center justify-between gap-1 border-l-2 pl-3 text-[#5B635C] ${referenceMode && adjustmentIndex === 0 ? "border-[#D9AE57]" : "border-[#E6E4DC]"}`}>
                            <div>
                              <span className="font-semibold text-ink">
                                {adj.adjustment_type === "extra_lessons"
                                  ? `+${adj.lesson_delta} ders hakkı eklendi`
                                  : adj.adjustment_type === "package_assigned"
                                    ? (referenceMode ? `Paket tanımlandı · ${adj.lesson_delta} ders` : `Paket Tanımlandı (${adj.lesson_delta} Ders)`)
                                    : adj.adjustment_type === "lesson_completed"
                                      ? "-1 Ders Tamamlandı"
                                      : adj.adjustment_type === "past_lesson_added"
                                        ? "-1 Ders Eklendi"
                                      : `${adj.lesson_delta} Ders Düzeltmesi`}
                              </span>
                              {adj.reason && adj.adjustment_type === "extra_lessons" && <span className="text-[#5B635C]"> — {adj.reason}</span>}
                              {!referenceMode && adj.notes && <span className="text-ink/70"> · “{adj.notes}”</span>}
                            </div>
                            <span className="text-[10px]">
                              {new Date(adj.created_at).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{!referenceMode && !["lesson_completed","past_lesson_added"].includes(adj.adjustment_type) ? ` · ${formatPaymentStatus(adj.payment_status)}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
        ) : (
          <div className={`p-6 text-center text-sm text-[#5B635C] ${referenceMode ? "" : "rounded-2xl border border-dashed border-border bg-surface-muted/40"}`}>
            Öğrencinin aktif ders hakkı bulunan paketi bulunmamaktadır.
          </div>
        )}
      </section>

      {/* 2. ARŞİV / TAMAMLANAN PAKETLER */}
      {!referenceMode && purchases.filter((p) => p.status !== "active" || (p.lesson_count || 0) - (p.lessons_used || 0) <= 0).length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Arşiv / Tamamlanan Paketler ({purchases.filter((p) => p.status !== "active" || (p.lesson_count || 0) - (p.lessons_used || 0) <= 0).length})
            </h4>
          </div>
          {purchases
            .filter((p) => p.status !== "active" || (p.lesson_count || 0) - (p.lessons_used || 0) <= 0)
            .map((p) => {
              const pkgAdjustments = adjustments.filter((a) => a.package_purchase_id === p.id);
              const extraLessonsSum = pkgAdjustments
                .filter((a) => a.adjustment_type === "extra_lessons")
                .reduce((sum, a) => sum + (a.lesson_delta || 0), 0);
              const baseLessonCount = Math.max(0, p.lesson_count - extraLessonsSum);
              const remaining = Math.max(0, p.lesson_count - p.lessons_used);
              const pct = Math.min(100, p.lesson_count ? Math.round((p.lessons_used / p.lesson_count) * 100) : 0);
              const title = packageDisplayName(p);
              const isRefunded = p.status === "refunded";
              const isCompleted = !isRefunded && (p.status === "completed" || p.lessons_used >= p.lesson_count);
              const statusLabel = isRefunded ? "İade Edildi" : isCompleted ? "Tamamlandı / Arşiv" : "Arşiv";

              return (
                <div key={p.id} className="rounded-2xl border border-border/80 bg-surface-muted/40 p-4 text-xs space-y-3.5 opacity-90">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-ink">{title}</h4>
                        {extraLessonsSum > 0 && (
                          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            +{extraLessonsSum} Ek Ders
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.start_date}
                        {p.end_date ? ` — ${p.end_date}` : " (Süresiz)"}
                        {p.price_amount !== null ? ` · ${money(p.price_amount, p.currency)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isRefunded ? "bg-rose-100 text-rose-800" : "bg-slate-200/80 text-slate-800"}`}>
                        {statusLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAdjustmentModal(p.id, "add")}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors"
                        >
                          <Plus className="size-3" />
                          Ders Hakkı Ekle
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Entitlement Details */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Kullanılan: <strong>{p.lessons_used}</strong> / {p.lesson_count} ders ({pct}%)
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        Kalan: <strong>{remaining} ders</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-slate-400 transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {extraLessonsSum > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Baz Paket: <strong>{baseLessonCount} ders</strong> · Ek Dersler: <strong>+{extraLessonsSum} ders</strong> · Toplam Hak: <strong>{p.lesson_count} ders</strong>
                      </p>
                    )}
                  </div>

                  {/* Info Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border text-[11px] text-muted-foreground">
                    <span>Ödeme Durumu: <strong>{formatPaymentStatus(p.payment_status)}</strong></span>
                    <span>·</span>
                    <span>Kaynak: <strong>{p.assignment_source === "admin_manual" ? "Yönetici Tanımlı" : "Satın Alma"}</strong></span>
                    {p.admin_notes && (
                      <>
                        <span>·</span>
                        <span className="italic text-ink/80">Not: {p.admin_notes}</span>
                      </>
                    )}
                  </div>

                  {/* Adjustment History Timeline — referans görünümde gösterilmez (PDF-21). */}
                  {!referenceMode && pkgAdjustments.length > 0 && (
                    <div className="mt-2 rounded-xl bg-surface p-3 text-[11px] space-y-2 border border-border">
                      <div className="flex items-center gap-1.5 font-bold text-ink">
                        <History className="size-3.5 text-primary" />
                        <span>Paket Düzeltme & Ek Ders Geçmişi</span>
                      </div>
                      <ul className="space-y-1.5 pl-2">
                        {pkgAdjustments.map((adj) => (
                          <li key={adj.id} className="flex flex-wrap items-center justify-between gap-1 text-muted-foreground border-l-2 border-primary/40 pl-2">
                            <div>
                              <span className="font-semibold text-ink">
                                {adj.adjustment_type === "extra_lessons"
                                  ? `+${adj.lesson_delta} Ek Ders`
                                  : adj.adjustment_type === "package_assigned"
                                    ? `Paket Tanımlandı (${adj.lesson_delta} Ders)`
                                    : adj.adjustment_type === "lesson_completed"
                                      ? "-1 Ders Tamamlandı"
                                      : adj.adjustment_type === "past_lesson_added"
                                        ? "-1 Ders Eklendi"
                                      : `${adj.lesson_delta} Ders Düzeltmesi`}
                              </span>
                              {adj.reason && <span className="text-ink/80"> — {adj.reason}</span>}
                              {adj.notes && <span className="text-ink/70"> · “{adj.notes}”</span>}
                            </div>
                            <span className="text-[10px]">
                              {new Date(adj.created_at).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{!["lesson_completed","past_lesson_added"].includes(adj.adjustment_type) ? ` · ${formatPaymentStatus(adj.payment_status)}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// NOTES PANEL
// ----------------------------------------------------------------------------

function NotesPanel({
  notes,
  busy,
  setBusy,
  setError,
  userId,
  changed,
  referenceMode,
  actionRequest,
}: {
  notes: Tables<"student_admin_notes">[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  userId: string;
  changed: () => void;
  referenceMode: boolean;
  actionRequest?: { type: "add_lesson" | "add_package" | "add_note"; nonce: number } | null;
}) {
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (actionRequest?.type !== "add_note") return;
    document.getElementById("student-private-note")?.focus();
  }, [actionRequest?.nonce, actionRequest?.type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setError("");
    const { error } = await addStudentPrivateNote(userId, note);
    setBusy(false);
    if (error) setError(error.message);
    else {
      setNote("");
      changed();
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editingText.trim()) return;
    setActionBusy(true);
    setError("");
    const { error } = await updateStudentPrivateNote(id, editingText, userId);
    setActionBusy(false);
    if (error) setError(error.message);
    else {
      setEditingId(null);
      setEditingText("");
      changed();
    }
  }

  async function handleDelete(id: string) {
    setActionBusy(true);
    setError("");
    const { error } = await deleteStudentPrivateNote(id, userId);
    setActionBusy(false);
    if (error) setError(error.message);
    else {
      setDeleteConfirmId(null);
      changed();
    }
  }

  if (referenceMode) return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-[20px] border border-[#E6E4DC] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-2xl font-semibold text-[#1C231E]">Özel Yönetici Notu</h2><p className="mt-1 text-sm text-[#5B635C]">Öğrenci hakkında özel notlar, çalışma hedefleri veya danışmanlık detayları.</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-[#EBC4BD] bg-[#FBECEA] px-2.5 py-1 text-xs font-semibold text-[#9A3324]"><Lock className="size-3.5" />Yalnızca yöneticiler görür</span></div>
        <textarea id="student-private-note" required maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="min-h-[120px] w-full resize-y rounded-[14px] border border-[#D9D6CC] bg-[#F7F6F1] px-4 py-3.5 text-[15px] text-[#1C231E] outline-none focus:bg-white focus:ring-2 focus:ring-[#10271B]" placeholder="Notunuzu yazın…" />
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-[13px] text-[#5B635C]">Öğrenci paneline hiçbir zaman yansıtılmaz.</span><button disabled={busy || !note.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1D1E1B] pl-2.5 pr-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(20,20,18,0.18)] hover:bg-[#30312C] disabled:bg-[#A9A8A2] disabled:shadow-none"><span className="inline-flex size-6 items-center justify-center rounded-full bg-white/20" aria-hidden="true"><Plus className="size-3.5" /></span>{busy ? "Kaydediliyor…" : "Not Ekle"}</button></div>
      </form>
      <section className="overflow-hidden rounded-[20px] border border-[#E6E4DC] bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#E6E4DC] px-6 py-5"><h2 className="font-heading text-[22px] font-semibold text-[#1C231E]">Kayıtlı Notlar</h2><span className="rounded-full bg-[#F0EFE9] px-2.5 py-0.5 text-[13px] font-bold text-[#4A524B]">{notes.length}</span></div>
        {notes.length ? <div className="divide-y divide-[#E6E4DC]">{notes.map((item) => (
          <article key={item.id} className="space-y-3 px-6 py-5">
            {editingId === item.id ? <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={4} className="w-full rounded-xl border border-[#D9D6CC] p-3 text-sm" /> : <p className="whitespace-pre-wrap text-sm leading-6 text-[#1C231E]">{item.note}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5B635C]"><span>{new Date(item.created_at).toLocaleString("tr-TR")}</span><div className="flex gap-2">{editingId === item.id ? <><button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-[#D9D6CC] px-3 py-1.5 font-semibold">Vazgeç</button><button type="button" disabled={actionBusy} onClick={() => void handleSaveEdit(item.id)} className="rounded-lg bg-[#10271B] px-3 py-1.5 font-semibold text-white">Kaydet</button></> : <><button type="button" onClick={() => { setEditingId(item.id); setEditingText(item.note); }} className="rounded-lg border border-[#D9D6CC] px-3 py-1.5 font-semibold">Düzenle</button><button type="button" onClick={() => setDeleteConfirmId(item.id)} className="rounded-lg border border-[#E6C5C0] px-3 py-1.5 font-semibold text-[#9A3324]">Sil</button></>}</div></div>
            {deleteConfirmId === item.id && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FBECEA] p-3 text-xs text-[#9A3324]"><b>Bu not silinsin mi?</b><div className="flex gap-2"><button type="button" onClick={() => setDeleteConfirmId(null)}>Vazgeç</button><button type="button" disabled={actionBusy} onClick={() => void handleDelete(item.id)} className="rounded-lg bg-[#9A3324] px-3 py-1.5 font-semibold text-white">Evet, sil</button></div></div>}
          </article>
        ))}</div> : <div className="flex items-center gap-4 px-6 py-10"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#F7F6F1]"><StickyNote className="size-7 text-[#5B635C]" /></div><div><div className="text-[17px] font-semibold">Henüz not eklenmedi</div><div className="mt-1 text-sm text-[#5B635C]">Eklediğiniz notlar en yeniden eskiye doğru burada listelenecek.</div></div></div>}
      </section>
    </div>
  );

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <h4 className="flex items-center gap-2 text-xs font-bold text-ink">
          <StickyNote className="size-4 text-primary" />
          Özel Yönetici Notu Ekle
        </h4>
        <p className="text-[11px] text-muted-foreground">
          Bu notlar yalnızca yöneticiler tarafından görüntülenebilir; öğrenci paneline asla yansıtılmaz.
        </p>
        <textarea
          required
          maxLength={5000}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={field}
          placeholder="Öğrenci hakkında özel notlar, çalışma hedefleri veya danışmanlık detayları..."
        />
        <div className="flex justify-end">
          <Submit busy={busy}>Not Ekle</Submit>
        </div>
      </form>

      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Kayıtlı Özel Notlar ({notes.length})
        </h4>

        {notes.length ? (
          notes.map((n) => {
            const isEditing = editingId === n.id;
            const isDeleting = deleteConfirmId === n.id;
            const isEdited = Boolean(n.updated_at && n.updated_at !== n.created_at);

            return (
              <div key={n.id} className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-3 shadow-xs">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      required
                      maxLength={5000}
                      rows={3}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className={field}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => {
                          setEditingId(null);
                          setEditingText("");
                        }}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy || !editingText.trim()}
                        onClick={() => void handleSaveEdit(n.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        {actionBusy ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  </div>
                ) : isDeleting ? (
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 space-y-2 text-xs">
                    <p className="font-semibold text-red-900">Bu notu arşive taşımak istediğinizden emin misiniz?</p>
                    <p className="text-[11px] text-red-700 italic line-clamp-2">&quot;{n.note}&quot;</p>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-xl border border-border bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void handleDelete(n.id)}
                        className="rounded-xl bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer disabled:opacity-50"
                      >
                        {actionBusy ? "Arşivleniyor..." : "Arşive Taşı"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink font-sans">{n.note}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{new Date(n.created_at).toLocaleString("tr-TR")}</span>
                        {isEdited && (
                          <span className="italic text-muted-foreground">
                            (düzenlendi: {new Date(n.updated_at).toLocaleString("tr-TR")})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditingText(n.note);
                            setDeleteConfirmId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors"
                          title="Notu Düzenle"
                        >
                          <Pencil className="size-3 text-muted-foreground" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirmId(n.id);
                            setEditingId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Notu Arşivle"
                        >
                          <Trash2 className="size-3 text-red-600" />
                          <span>Arşivle</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <Empty>Henüz kayıtlı özel yönetici notu bulunmuyor.</Empty>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// UI HELPERS
// ----------------------------------------------------------------------------

const field =
  "min-h-[46px] w-full rounded-xl border border-[#D9D6CC] bg-white px-3.5 py-2 text-[15px] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-[#C0902F]";

function Input({
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <input
      required={required}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={field}
    />
  );
}

function Submit({
  busy,
  disabled = false,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={busy || disabled}
      className="inline-flex min-h-9 w-fit items-center gap-1 rounded-lg bg-ink px-3 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
    >
      <Plus className="size-3" />
      {busy ? "Kaydediliyor…" : children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background-soft/50 p-3 text-xs [&_p]:mt-1 [&_p]:text-muted-foreground">
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="h-fit rounded-full border border-border bg-white px-2 py-0.5 text-[10px] font-semibold">
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{children}</div>;
}

import { formatCurrency } from "@/lib/format/currency";

function money(amount: number, currency: string) {
  return formatCurrency(amount, { currency, locale: "tr" });
}

/** Referans görünüm: sembol başta (₺72.000 / €1.250,50). */
function symbolMoney(amount: number, currency: string) {
  const value = Number(amount || 0);
  const fraction = Math.abs(value % 1) >= 0.009 ? 2 : 0;
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: (currency || "TRY").toUpperCase(), minimumFractionDigits: fraction, maximumFractionDigits: fraction }).format(value);
  } catch {
    return money(value, currency);
  }
}

/** "21 Eylül 2026" */
function longDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
}

function paymentMethodLabel(method: string | null | undefined) {
  return method === "bank_transfer" ? "Havale / EFT" : method === "card" ? "Kredi Kartı" : "—";
}

function AdminExamHistoryPanel({ userId }: { userId: string }) {
  const [attempts, setAttempts] = useState<StudentExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAttempt, setSelectedAttempt] = useState<StudentExamAttempt | null>(null);

  useEffect(() => {
    let active = true;
    listStudentExamAttempts(userId).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        setAttempts(res.data || []);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return <div className="p-4 text-xs text-muted-foreground animate-pulse">Sınav geçmişi yükleniyor...</div>;
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  if (attempts.length === 0) {
    return <Empty>Bu öğrencinin tamamladığı kayıtlı bir değerlendirme / sınav bulunmuyor.</Empty>;
  }

  const total = attempts.length;
  const avg = Math.round(attempts.reduce((s, a) => s + (a.accuracy || 0), 0) / total);

  return (
    <div className="space-y-4">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Toplam Sınav</span>
          <p className="text-lg font-bold text-ink mt-0.5">{total}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Ortalama Başarı</span>
          <p className="text-lg font-bold text-ink mt-0.5">%{avg}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">En Yüksek</span>
          <p className="text-lg font-bold text-emerald-800 mt-0.5">%{Math.max(...attempts.map((a) => a.accuracy || 0))}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-center">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Son Sınav</span>
          <p className="text-xs font-semibold text-ink mt-1 truncate">{attempts[0]?.exam_code} ({new Date(attempts[0]?.completed_at).toLocaleDateString("tr-TR")})</p>
        </div>
      </div>

      {/* Attempts List */}
      <div className="divide-y divide-border rounded-xl border border-border bg-white overflow-hidden">
        {attempts.map((att) => {
          const acc = att.accuracy || 0;
          const isStr = acc >= 75;
          const isMod = acc >= 40 && acc < 75;
          return (
            <div key={att.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 text-xs font-bold uppercase">
                  {att.exam_code}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{att.exam_code} Kendini Dene</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isStr ? "bg-emerald-100 text-emerald-800" : isMod ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
                      %{acc} Başarı
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(att.completed_at).toLocaleString("tr-TR")} · {att.correct_count}/{att.total_questions} Doğru · {att.locale.toUpperCase()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAttempt(att)}
                className="self-end sm:self-auto rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-slate-100 cursor-pointer"
              >
                Detayları İncele
              </button>
            </div>
          );
        })}
      </div>

      {/* Admin Attempt Detail Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Sınav Analiz Detayı</span>
                <h3 className="text-xl font-bold text-ink mt-1">
                  {selectedAttempt.exam_code} · {new Date(selectedAttempt.completed_at).toLocaleString("tr-TR")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Score cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Doğru</span>
                <p className="text-lg font-bold text-emerald-950">{selectedAttempt.correct_count} / {selectedAttempt.total_questions}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5">
                <span className="text-[10px] font-bold text-rose-800 uppercase">Yanlış</span>
                <p className="text-lg font-bold text-rose-950">{selectedAttempt.incorrect_count} / {selectedAttempt.total_questions}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-sage-soft p-2.5">
                <span className="text-[10px] font-bold text-primary uppercase">Başarı</span>
                <p className="text-lg font-bold text-ink">%{selectedAttempt.accuracy}</p>
              </div>
            </div>

            {/* Topic Breakdown */}
            {selectedAttempt.topic_analysis?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Konu Dağılımı</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedAttempt.topic_analysis.map((t) => (
                    <div key={t.id || t.label} className="rounded-lg border border-border p-2 bg-slate-50 flex justify-between items-center">
                      <span className="font-medium text-ink">{t.label}</span>
                      <span className="font-bold text-primary">%{t.accuracy} ({t.correct}/{t.total})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question Breakdown One-by-One Review */}
            {selectedAttempt.question_snapshots && selectedAttempt.question_snapshots.length > 0 && (
              <div className="pt-2">
                <ExamQuestionReview
                  items={selectedAttempt.question_snapshots.map((q, idx) => ({
                    id: q.id || String(idx),
                    questionNumber: idx + 1,
                    topic: q.topicLabel,
                    prompt: q.prompt,
                    selectedAnswerId: null,
                    correctAnswerId: "",
                    selectedAnswerText: q.selectedAnswer,
                    correctAnswerText: q.correctAnswer,
                    isCorrect: q.wasCorrect,
                    explanation: q.explanation,
                  }))}
                  locale="tr"
                />
              </div>
            )}

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAttempt(null)}
                className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Referans "Yapılan Dersler" (PDF-16/21): ay başlığı, altın tarih rozeti, açılır detay. */
type RefLessonParts = { day: string; month: string; monthTitle: string; weekday: string; time: string; fullDate: string };
function refLessonParts(lesson: LessonRow): RefLessonParts {
  const timeZone = lesson.lesson_timezone || "Europe/Istanbul";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("tr-TR", { timeZone, day: "2-digit", month: "long", year: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(lesson.lesson_date)).map((part) => [part.type, part.value]));
  const shortMonth = new Intl.DateTimeFormat("tr-TR", { timeZone, month: "short" }).format(new Date(lesson.lesson_date)).replace(".", "");
  const label = lesson.lesson_timezone_label && lesson.lesson_timezone_label !== "TR" ? ` ${lesson.lesson_timezone_label}` : "";
  return {
    day: parts.day,
    month: shortMonth.toLocaleUpperCase("tr-TR"),
    monthTitle: `${parts.month.charAt(0).toLocaleUpperCase("tr-TR")}${parts.month.slice(1)} ${parts.year}`,
    weekday: parts.weekday,
    time: `${parts.hour}:${parts.minute}${label}`,
    fullDate: `${parts.day} ${parts.month} ${parts.year}, ${parts.weekday}`,
  };
}

function RefCompletedLessonList({ lessons, notifications, topics, instructors, purchases, onEdit, onAdd }: {
  lessons: LessonRow[];
  notifications: LessonNotificationState[];
  topics: LessonReference[];
  instructors: InstructorReference[];
  purchases: PackagePurchase[];
  onEdit: (lesson: LessonRow) => void;
  onAdd: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const groups: { title: string; items: { lesson: LessonRow; parts: RefLessonParts }[] }[] = [];
  for (const lesson of lessons) {
    const parts = refLessonParts(lesson);
    const last = groups[groups.length - 1];
    if (last && last.title === parts.monthTitle) last.items.push({ lesson, parts });
    else groups.push({ title: parts.monthTitle, items: [{ lesson, parts }] });
  }
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E6E4DC] bg-white" data-ref-lessons="">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E4DC] px-6 py-5">
        <div className="flex items-center gap-2.5"><h2 className="font-heading text-[22px] font-semibold text-[#1C231E]">Yapılan Dersler</h2><span className="rounded-full bg-[#F0EFE9] px-2.5 py-0.5 text-[13px] font-bold text-[#4A524B]">{lessons.length}</span></div>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#5B635C]"><ArrowDownWideNarrow className="size-4" aria-hidden="true" />En yeni ders üstte</span>
      </div>
      {lessons.length ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="px-1 pb-2.5 pt-4 text-[13px] font-bold text-[#8A6A1F]">{group.title}</div>
              <ul className="m-0 grid list-none gap-3 p-0">
                {group.items.map(({ lesson, parts }) => {
                  const delivery = notifications.find((item) => item.entity_id === lesson.id && item.event_type === "lesson.report_email");
                  const topic = topics.find((item) => item.id === lesson.topic_id)?.label || lesson.subject || "—";
                  const instructor = instructors.find((item) => item.id === lesson.instructor_id)?.name || "—";
                  const purchase = purchases.find((item) => item.id === lesson.package_purchase_id);
                  const duration = `${lesson.duration_minutes} dk`;
                  const reportStatus = delivery?.status === "sent"
                    ? `Gönderildi · ${new Date(delivery.sent_at || delivery.created_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}`
                    : lesson.completion_report ? "Taslak kaydedildi" : "Rapor bekleniyor";
                  const open = expandedId === lesson.id;
                  const detailId = `ref-lesson-${lesson.id}`;
                  return (
                    <li key={lesson.id} className="overflow-hidden rounded-2xl border border-[#E6E4DC] bg-white" data-ref-lesson="">
                      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
                        <div className="flex h-[58px] w-[56px] shrink-0 flex-col items-center justify-center rounded-xl border border-[#E6D3A8] bg-[#F6EFDD]" aria-hidden="true"><b className="font-heading text-[26px] font-semibold leading-none text-[#1C231E]">{parts.day}</b><span className="mt-1 text-[11px] font-bold tracking-wider text-[#A57622]">{parts.month}</span></div>
                        <button type="button" onClick={() => setExpandedId(open ? null : lesson.id)} aria-expanded={open} aria-controls={detailId} className="min-w-0 flex-1 cursor-pointer text-left">
                          <span className="block truncate text-[17px] font-semibold text-[#1C231E]">{lesson.title}</span>
                          <span className="mt-1 block text-[13px] text-[#5B635C]">{topic} · {parts.weekday} {parts.time} · {duration}</span>
                        </button>
                        <button type="button" onClick={() => setExpandedId(open ? null : lesson.id)} aria-expanded={open} aria-controls={detailId} aria-label={open ? "Ders detayını kapat" : "Ders detayını aç"} className="hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#5B635C] hover:bg-[#F7F6F1] sm:inline-flex"><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
                        <button type="button" onClick={() => onEdit(lesson)} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#D9D6CC] bg-white px-3.5 text-[13px] font-semibold text-[#1C231E] hover:bg-[#F7F6F1]"><Pencil className="size-3.5" />Düzenle</button>
                      </div>
                      {open ? (
                        <div id={detailId} className="border-t border-[#EEECE5] px-4 pb-4 pt-4 sm:px-5">
                          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                            {([["Ders", lesson.title], ["Konu / Alan", topic], ["Eğitmen", instructor], ["Tarih", parts.fullDate], ["Saat", parts.time], ["Süre", duration], ["Paket", purchase ? packageDisplayName(purchase) : "—"]] as const).map(([label, value]) => (
                              <div key={label} className="min-w-0"><dt className="text-xs text-[#5B635C]">{label}</dt><dd className="m-0 mt-0.5 text-sm font-medium text-[#1C231E] [overflow-wrap:anywhere]">{value}</dd></div>
                            ))}
                          </dl>
                          <div className="mt-4 rounded-xl bg-[#F7F6F1] px-4 py-3">
                            <div className="text-xs text-[#5B635C]">Ders sonu raporu · {reportStatus}</div>
                            <p className="m-0 mt-1.5 whitespace-pre-wrap text-sm text-[#1C231E] [overflow-wrap:anywhere]">{lesson.completion_report || "Henüz rapor yazılmadı."}</p>
                          </div>
                        </div>
                      ) : (
                        <div id={detailId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EEECE5] bg-[#FAF8F2] px-4 py-3 sm:px-5"><span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1C231E]"><FileText className="size-4 text-[#A57622]" />Ders sonu raporu</span><span className="text-xs text-[#5B635C]">{reportStatus}</span></div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 px-6 py-10"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#F7F6F1]"><BookOpen className="size-7 text-[#5B635C]" /></div><div className="flex-1"><div className="text-[17px] font-semibold">Henüz yapılan ders kaydı yok</div><div className="mt-1 text-sm text-[#5B635C]">Tamamlanan dersleri ekledikçe burada tarih sırasıyla listelenecek.</div></div><button type="button" onClick={onAdd} className="rounded-xl border border-[#D9D6CC] px-4 py-2.5 text-sm font-semibold">İlk kaydı ekle</button></div>
      )}
    </section>
  );
}
