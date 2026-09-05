"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  PackagePlus,
  Plus,
  Minus,
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
  sendLessonCompletedEmail,
  listStudentLearning,
  sendLessonMeetingLink,
  sendPackageNotificationEmail,
  upsertStudentLesson,
  type PackageOption,
  type PackagePurchase,
  type PackageAdjustment,
  type StudentPayment,
} from "@/lib/admin/student-learning";
import { AssignHomeworkModal } from "@/components/admin/homework/AssignHomeworkModal";
import { HomeworkSubmissionReview } from "@/components/admin/HomeworkSubmissionReview";
import type { Tables } from "@/types/database.types";
import { listStudentExamAttempts, type StudentExamAttempt } from "@/lib/student/exam-history";
import { ExamQuestionReview } from "@/components/exam-test/ExamQuestionReview";
import { canonicalExams } from "@/content/canonical-exams";
import { adminLessonCopy } from "@/content/admin-lessons";
import { previewLessonAdjustment } from "@/lib/admin/lesson-adjustments";
import { useToast } from "@/components/ui/toast";

export type LearningSection = "lessons" | "homework" | "packages" | "payments" | "notes" | "exam_history";

export function StudentLearningManager({
  userId,
  studentName = "Seçili öğrenci",
  section,
  onChanged,
  onPlan,
}: {
  userId: string;
  studentName?: string;
  section: LearningSection;
  onChanged?: () => void;
  onPlan?: () => void;
}) {
  const [lessons, setLessons] = useState<Tables<"student_lessons">[]>([]);
  const [homework, setHomework] = useState<Tables<"student_homework">[]>([]);
  const [purchases, setPurchases] = useState<PackagePurchase[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [notes, setNotes] = useState<Tables<"student_admin_notes">[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [adjustments, setAdjustments] = useState<PackageAdjustment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await listStudentLearning(userId);
    setLessons(r.lessons);
    setHomework(r.homework);
    setPurchases(r.purchases);
    setPayments(r.payments);
    setNotes(r.notes);
    setPackages(r.packages);
    setAdjustments(r.adjustments);
    setError(r.error || "");
  }, [userId]);

  useEffect(() => {
    let active = true;
    listStudentLearning(userId).then((r) => {
      if (!active) return;
      setLessons(r.lessons);
      setHomework(r.homework);
      setPurchases(r.purchases);
      setPayments(r.payments);
      setNotes(r.notes);
      setPackages(r.packages);
      setAdjustments(r.adjustments);
      setError(r.error || "");
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const changed = () => {
    void load();
    onChanged?.();
  };

  if (error) return <Notice tone="error">{error}</Notice>;

  if (section === "lessons") {
    return (
      <LessonsPanel
        lessons={lessons}
        purchases={purchases}
        userId={userId}
        studentName={studentName}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        changed={changed}
        onPlan={onPlan}
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
        packages={packages}
        adjustments={adjustments}
        userId={userId}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        changed={changed}
      />
    );
  }

  if (section === "payments") {
    return (
      <div className="space-y-2">
        {payments.length ? (
          payments.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between gap-3">
                <strong>{money(p.amount, p.currency)}</strong>
                <Badge>{formatPaymentStatus(p.status)}</Badge>
              </div>
              <p>
                {p.payment_method === "bank_transfer" ? "Havale / EFT" : "Kart"} · {p.public_reference} ·{" "}
                {new Date(p.created_at).toLocaleString("tr-TR")}
              </p>
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
    />
  );
}

// ----------------------------------------------------------------------------
// LESSONS & LIVE LESSON LINK PANEL
// ----------------------------------------------------------------------------

function LessonsPanel({
  lessons,
  purchases,
  userId,
  studentName,
  busy,
  setBusy,
  setError,
  changed,
  onPlan,
}: {
  lessons: Tables<"student_lessons">[];
  purchases: PackagePurchase[];
  userId: string;
  studentName: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
  onPlan?: () => void;
}) {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const toast = useToast();
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonTypeSelection, setLessonTypeSelection] = useState<"past" | "future" | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Tables<"student_lessons"> | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Manual email dispatch is tracked per button, not through the panel-wide
  // `busy` flag: only the clicked button spins and disables, the sheet stays
  // open, and nothing else on the panel is blocked. `sentEmails` flips the
  // label to "Tekrar Gonder" once a deliberate first send has succeeded.
  const [sendingEmailKey, setSendingEmailKey] = useState<string | null>(null);
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const lessonCopy = adminLessonCopy.tr;

  const activePackage = purchases.find((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0) || null;

  const nowIso = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    title: "Birebir Canlı Ders",
    subject: "Matematik / Sınav Hazırlığı",
    examCode: "SAT",
    lessonDate: nowIso,
    durationMinutes: 60,
    packagePurchaseId: activePackage?.id || "",
    liveMeetingUrl: "",
    teacherNote: "",
  });
  const [pastRequestKey, setPastRequestKey] = useState(() => crypto.randomUUID());
  const [pastForm, setPastForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: new Date().toTimeString().slice(0, 5),
    durationMinutes: 60,
    title: lessonCopy.defaultTitle as string,
    subject: lessonCopy.defaultSubject as string,
    teacherNote: "",
    packagePurchaseId: "",
  });

  async function handleRecordPastLesson(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    const lessonIso = new Date(`${pastForm.date}T${pastForm.startTime}:00`).toISOString();
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
      title: pastForm.title,
      subject: pastForm.subject,
      teacherNote: pastForm.teacherNote,
      packagePurchaseId: pastForm.packagePurchaseId || null,
      idempotencyKey: `admin-past:${pastRequestKey}`,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error || lessonCopy.failure);
      return;
    }
    setIsLessonModalOpen(false);
    setLessonTypeSelection(null);
    setPastRequestKey(crypto.randomUUID());
    toast.success("Geçmiş ders başarıyla kaydedildi ve paketten 1 ders hakkı düşüldü.");
    changed();
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const lessonTime = new Date(form.lessonDate).getTime();
    if (lessonTime < Date.now() - 15 * 60_000) {
      setBusy(false);
      setError("Gelecek ders için geçmiş bir tarih veya saat seçilemez. Lütfen ileri bir tarih giriniz veya 'Geçmiş Ders' seçeneğini kullanınız.");
      return;
    }

    const res = await upsertStudentLesson({
      studentId: userId,
      packagePurchaseId: form.packagePurchaseId || null,
      title: form.title.trim(),
      subject: form.subject.trim(),
      examCode: form.examCode.trim() || null,
      lessonDate: new Date(form.lessonDate).toISOString(),
      durationMinutes: Number(form.durationMinutes) || 60,
      liveMeetingUrl: form.liveMeetingUrl.trim() || null,
      teacherNote: form.teacherNote.trim() || null,
      status: "scheduled",
    });

    setBusy(false);
    if (!res.success) {
      setError(res.error || "Ders kaydedilemedi.");
    } else {
      setIsLessonModalOpen(false);
      setLessonTypeSelection(null);
      toast.success("Gelecek canlı ders başarıyla planlandı. Ders tamamlandığında paketten 1 hak düşülecektir.");
      changed();
    }
  }

  // MAIL-026: explicit admin action only. Creating a lesson, adding a meeting
  // link or updating one never sends this mail on its own.
  async function handleSendLink(lesson: Tables<"student_lessons">) {
    if (!lesson.live_meeting_url) {
      setError("Ders için tanımlı bir canlı ders bağlantısı bulunmuyor.");
      return;
    }
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
    setBusy(true);
    setError("");

    const res = await completeStudentLesson({
      lessonId: completeTarget.id,
      packagePurchaseId: null,
      teacherNote: completionNote.trim() || null,
    });

    setBusy(false);
    setCompleteTarget(null);
    setCompletionNote("");

    if (!res.success) {
      setError(res.error || "Ders tamamlanamadı.");
    } else {
      toast.success(
        res.alreadyCompleted
          ? "Ders zaten tamamlanmış olarak işaretliydi."
          : "Ders başarıyla tamamlandı ve paketten 1 ders düşüldü."
      );
      changed();
    }
  }

  // MAIL-027: explicit admin action only. Lesson completion and the lesson-right
  // decrement never depend on this mail succeeding.
  async function handleSendCompletedNotification(lesson: Tables<"student_lessons">) {
    const key = `completed-${lesson.id}`;
    if (sendingEmailKey === key) return;
    setSendingEmailKey(key);
    setError("");
    const res = await sendLessonCompletedEmail(lesson.id);
    setSendingEmailKey(null);
    if (!res.success) {
      setError(res.error || "Ders kaydedildi ancak e-posta gönderilemedi.");
    } else {
      setSentEmails((prev) => new Set(prev).add(key));
      toast.success("Ders bilgilendirme e-postası hesap sahibine başarıyla gönderildi.");
      changed();
    }
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

  return (
    <div className="space-y-4">
      {confirmationDialog}

      {/* Top Header & Add Live Lesson Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
          <Video className="size-4 text-primary" />
          Canlı Dersler ve Ders Geçmişi ({lessons.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setIsLessonModalOpen((prev) => !prev);
              setLessonTypeSelection(null);
              setError("");
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-primary bg-primary/10 px-4 text-xs font-bold text-primary shadow-xs hover:bg-primary/15 cursor-pointer"
          >
            <Plus className="size-4" />
            {isLessonModalOpen ? "Formu Kapat" : "Ders Tanımla / Planla"}
          </button>
        </div>
      </div>

      {isLessonModalOpen && (
        <div className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5 text-xs shadow-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="font-bold text-ink text-sm">Ders Tanımla / Planla</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {studentName} ({lessonCopy.accountEmail})
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
            <div className="grid gap-2.5 sm:grid-cols-2">
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
                    <span>○ Geçmiş Ders</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    Tamamlanmış bir dersin kaydı oluşturulur. Öğrencinin aktif paketinden 1 ders hakkı düşülür ve hesap sahibine güncel kalan ders hakkı bildirimi iletilir.
                  </div>
                </div>
              </label>

              <label
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
                    Gelecekteki bir canlı ders takvime planlanır. Ders hakkı bu aşamada düşülmez; ders tamamlandığında düşülecek ve bitiş saatinden 1 saat sonra kalan hak bildirimi gönderilecektir.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {lessonTypeSelection === null && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-center text-xs text-amber-900">
              Devam etmek için lütfen yukarıdan <strong>Geçmiş Ders</strong> veya <strong>Gelecek Ders</strong> seçeneğini belirleyiniz.
            </div>
          )}

          {/* Form for PAST Lesson */}
          {lessonTypeSelection === "past" && (
            <form onSubmit={handleRecordPastLesson} className="grid gap-3 animate-in fade-in duration-150">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.title}
                  <Input
                    required
                    placeholder={lessonCopy.titlePlaceholder}
                    value={pastForm.title}
                    onChange={(value) => setPastForm({ ...pastForm, title: value })}
                  />
                </label>
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.subject}
                  <Input
                    required
                    placeholder={lessonCopy.subjectPlaceholder}
                    value={pastForm.subject}
                    onChange={(value) => setPastForm({ ...pastForm, subject: value })}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.date} (Geçmiş Tarih)
                  <input
                    required
                    type="date"
                    value={pastForm.date}
                    onChange={(event) => setPastForm({ ...pastForm, date: event.target.value })}
                    className={field}
                  />
                </label>
                <label className="font-semibold text-muted-foreground">
                  {lessonCopy.startTime}
                  <input
                    required
                    type="time"
                    value={pastForm.startTime}
                    onChange={(event) => setPastForm({ ...pastForm, startTime: event.target.value })}
                    className={field}
                  />
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
              </div>
              <label className="font-semibold text-muted-foreground">
                {lessonCopy.package}
                <select
                  value={pastForm.packagePurchaseId}
                  onChange={(event) => setPastForm({ ...pastForm, packagePurchaseId: event.target.value })}
                  className={field}
                >
                  <option value="">{lessonCopy.fifo}</option>
                  {purchases
                    .filter((purchase) => purchase.status === "active" && purchase.lessons_used < purchase.lesson_count)
                    .map((purchase) => (
                      <option key={purchase.id} value={purchase.id}>
                        {purchase.custom_package_name || purchase.pricing_packages?.name_tr || purchase.package_id} (
                        {purchase.lesson_count - purchase.lessons_used} {lessonCopy.remaining})
                      </option>
                    ))}
                </select>
              </label>
              <label className="font-semibold text-muted-foreground">
                {lessonCopy.note}
                <textarea
                  placeholder="Ders notu veya eğitmen geri bildirimi..."
                  value={pastForm.teacherNote}
                  onChange={(event) => setPastForm({ ...pastForm, teacherNote: event.target.value })}
                  className={field}
                />
              </label>
              <p className="rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Ders kaydedildiğinde hesap sahibine e-posta gönderilmez. İsterseniz kayıttan
                sonra ders kartındaki <strong>Ders Bilgilendirme E-postası Gönder</strong>
                {" "}butonunu kullanabilirsiniz.
              </p>
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
                  {busy ? lessonCopy.saving : "Geçmiş Dersi Kaydet"}
                </button>
              </div>
            </form>
          )}

          {/* Form for FUTURE Lesson */}
          {lessonTypeSelection === "future" && (
            <form onSubmit={handleCreateLesson} className="grid gap-3 animate-in fade-in duration-150">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Ders Başlığı</label>
                  <Input
                    required
                    placeholder="Örn: Birebir Matematik Dersi"
                    value={form.title}
                    onChange={(v) => setForm({ ...form, title: v })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Konu / Alan</label>
                  <Input
                    required
                    placeholder="Örn: SAT Math / Calculus"
                    value={form.subject}
                    onChange={(v) => setForm({ ...form, subject: v })}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
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
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Tarih & Saat (Gelecek Tarih)
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={form.lessonDate}
                    onChange={(e) => setForm({ ...form, lessonDate: e.target.value })}
                    className={field}
                  />
                </div>
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
                          {p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id} (
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
              onClick={() => setCompleteTarget(null)}
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
            <div>• Öğrencinin ilişkili paketinden <strong>1 ders hakkı güvenli şekilde düşülecektir</strong>.</div>
            <div>• E-posta bildirimi yalnızca aşağıdaki seçenek işaretlenirse gönderilir (Varsayılan: Kapalı).</div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tamamlama / Değerlendirme Notu (İsteğe Bağlı)</label>
            <textarea
              placeholder="Ders sırasında işlenen konular veya öğrencinin performansı..."
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              className={`${field} min-h-16`}
            />
          </div>
          <p className="rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Tamamlama işlemi hesap sahibine bilgilendirme e-postası göndermez. Ders
            tamamlandıktan sonra ders kartındaki
            {" "}<strong>Ders Bilgilendirme E-postası Gönder</strong> butonunu kullanabilirsiniz.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCompleteTarget(null)}
              className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirmComplete}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
            >
              {busy ? "İşleniyor…" : "Onayla ve Dersi Bitir"}
            </button>
          </div>
        </div>
      )}

      {/* Lesson Cards List */}
      <div className="space-y-3">
        {lessons.length ? (
          lessons.map((l) => {
            const isCompleted = l.status === "completed";
            const isCancelled = l.status === "cancelled";
            const isScheduled = l.status === "scheduled";

            return (
              <div
                key={l.id}
                className={`rounded-xl border p-4 text-xs transition-colors ${
                  isCompleted
                    ? "border-emerald-200 bg-emerald-50/30"
                    : isCancelled
                    ? "border-neutral-200 bg-neutral-50 opacity-60"
                    : "border-border bg-white shadow-xs"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-ink">{l.title}</strong>
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
                      {new Date(l.lesson_date).toLocaleString("tr-TR", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
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
                      <span>
                        {l.meeting_link_sent_at
                          ? `Son e-posta gönderimi: ${new Date(l.meeting_link_sent_at).toLocaleString("tr-TR")}`
                          : "Öğrenciye e-posta bağlantısı henüz iletilmedi."}
                      </span>
                      <button
                        type="button"
                        disabled={sendingEmailKey === `link-${l.id}`}
                        onClick={() => void handleSendLink(l)}
                        className="inline-flex items-center gap-1 text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        <Send className="size-3" />
                        {sendingEmailKey === `link-${l.id}`
                          ? "Gönderiliyor…"
                          : l.meeting_link_sent_at || sentEmails.has(`link-${l.id}`)
                            ? "Linki Öğrenciye Tekrar Gönder"
                            : "Linki Öğrenciye E-posta İle Gönder"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Teacher Note */}
                {l.teacher_note && (
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
                      onClick={() => setCompleteTarget(l)}
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

                {/* Actions for completed lessons: Manual email dispatch on-demand */}
                {isCompleted && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                    <button
                      type="button"
                      disabled={sendingEmailKey === `completed-${l.id}`}
                      onClick={() => void handleSendCompletedNotification(l)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Send className="size-3 text-emerald-700" />
                      <span>
                        {sendingEmailKey === `completed-${l.id}`
                          ? "Gönderiliyor…"
                          : sentEmails.has(`completed-${l.id}`)
                            ? "Bilgilendirme E-postasını Tekrar Gönder"
                            : "Ders Bilgilendirme E-postası Gönder"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <Empty>Henüz ders kaydı yok. Yukarıdaki butonla yeni canlı ders planlayabilirsiniz.</Empty>
        )}
      </div>
    </div>
  );
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
  packages,
  adjustments,
  userId,
  busy,
  setBusy,
  setError,
  changed,
}: {
  purchases: PackagePurchase[];
  packages: PackageOption[];
  adjustments: PackageAdjustment[];
  userId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [activeModal, setActiveModal] = useState<"none" | "assign_package" | "adjust_lessons">("none");
  // Manuel bilgilendirme e-postaları: her buton yalnız kendi yüklenme durumunu
  // kullanır, sayfa yenilenmez ve panel kapanmaz.
  const [mailSendingKey, setMailSendingKey] = useState<string | null>(null);
  const [mailSentKeys, setMailSentKeys] = useState<Set<string>>(new Set());

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
    setMailSentKeys((prev) => new Set(prev).add(key));
    toast.success(
      kind === "package_assigned"
        ? "Paket bilgilendirme e-postası hesap sahibine gönderildi."
        : "Ders hakkı güncelleme e-postası hesap sahibine gönderildi."
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
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    purchaseId: "",
    amount: "1",
    reason: "",
    notes: "",
  });

  const defaultPurchase = purchases.find((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0) || purchases[0];
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
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      setActiveModal("none");
      changed();
      toast.success("Paket başarıyla tanımlandı.");
    }
  }

  async function handleAdjustmentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAdjustmentPurchase) return;
    if (adjustmentAmount < 1 || adjustmentAmount > 500) {
      setError("Ders hakkı değişikliği 1 ile 500 arasında olmalıdır.");
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
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      setActiveModal("none");
      changed();
      const remaining = typeof res.newRemaining === "number" ? res.newRemaining : resultingRemaining;
      toast.success(
        adjustmentMode === "add"
          ? `Ders hakkı ${adjustmentAmount} adet artırıldı. Yeni kalan hak: ${remaining}.`
          : `Ders hakkı ${adjustmentAmount} adet azaltıldı. Yeni kalan hak: ${remaining}.`
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Header: Single [ Yeni Paket Tanımla ] CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-ink">Eğitim Paketleri & Ders Hakları</h3>
          <p className="text-xs text-muted-foreground">
            Öğrencinin kayıtlı paketlerini yönetin, yeni paket tanımlayın veya aktif paketlere ek ders ekleyin.
          </p>
        </div>
        <button
          type="button"
          onClick={openAssignModal}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors shadow-xs"
        >
          <PackagePlus className="size-3.5" />
          Yeni Paket Tanımla
        </button>
      </div>

      {/* COÖRDINATED IN-PLACE ACTION VIEW: Paket Tanımla */}
      {activeModal === "assign_package" && (
        <div className="rounded-3xl border border-primary/30 bg-white p-6 shadow-md space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                <PackagePlus className="size-4 text-primary" />
                Yeni Paket Tanımla
              </h4>
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="rounded-xl border border-border p-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Mode Switcher */}
              <div className="flex gap-2">
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
                <button
                  type="button"
                  onClick={() => setAssignMode("custom")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                    assignMode === "custom"
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                  }`}
                >
                  Özel Paket
                </button>
              </div>

              {assignMode === "catalog" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Katalog Paketi</label>
                    <select
                      required
                      value={packageForm.packageId}
                      onChange={(e) => chooseCatalogPackage(e.target.value)}
                      className={field}
                    >
                      <option value="">Seçiniz...</option>
                      {packages
                        .filter((p) => p.id !== "custom" && (p.lesson_count || 0) > 0 && !p.name_tr?.toLowerCase().includes("özel"))
                        .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name_tr || p.name_en || p.id} ({p.lesson_count} Ders · {money(Number(p.current_total ?? p.price_amount ?? 0), "TRY")})
                        </option>
                      ))}
                    </select>
                  </div>

                  {packageForm.packageId && (
                    <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-forest/5 p-3.5 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Seçilen Paket Özeti</span>
                        <strong className="text-sm font-bold text-ink">
                          {packageForm.lessonCount} Derslik Paket
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
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Özel Paket Adı</label>
                    <input
                      required
                      type="text"
                      placeholder="örn. 15 Derslik Özel Paket / Hızlandırılmış AP Calculus"
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
                      <input
                        required
                        type="number"
                        min="0"
                        value={packageForm.price}
                        onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
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

              <p className="rounded-xl border border-border bg-surface-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Paket kaydedildiğinde hesap sahibine e-posta gönderilmez. Kayıttan sonra paket
                kartındaki <strong>Paket Bilgilendirme E-postası Gönder</strong> butonuyla
                dilediğiniz zaman bilgilendirme yapabilirsiniz.
              </p>

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
      )}

      {/* COÖRDINATED IN-PLACE ACTION VIEW: Ders hakkı ekle / azalt */}
      {activeModal === "adjust_lessons" && selectedAdjustmentPurchase && (
        <div className="rounded-3xl border border-primary/30 bg-white p-6 shadow-md space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                {adjustmentMode === "add" ? <Plus className="size-4 text-emerald-700" /> : <Minus className="size-4 text-rose-700" />}
                {adjustmentMode === "add" ? "Ders Hakkı Ekle" : "Ders Hakkı Azalt"}
              </h4>
              <button
                type="button"
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
                        {p.custom_package_name || p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id} ({p.lessons_used}/{p.lesson_count} Ders · {p.status === "active" ? "Aktif" : p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Current Balance Banner */}
              <div className="rounded-xl border border-border bg-surface-muted/70 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between font-semibold text-ink">
                  <span>Mevcut Paket:</span>
                  <span>{selectedAdjustmentPurchase.custom_package_name || selectedAdjustmentPurchase.pricing_packages?.name_tr || selectedAdjustmentPurchase.package_id}</span>
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
                  max="500"
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
                  disabled={busy || adjustmentAmount < 1 || adjustmentAmount > 500 || adjustmentForm.reason.trim().length < 3 || resultingRemaining < 0}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer ${adjustmentMode === "add" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-700 hover:bg-rose-800"}`}
                >
                  {adjustmentMode === "add" ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                  {busy ? "Kaydediliyor..." : adjustmentMode === "add" ? "Ders Hakkını Ekle" : "Ders Hakkını Azalt"}
                </button>
              </div>
            </form>
        </div>
      )}

      {/* AGGREGATE ENTITLEMENT SUMMARY CARDS */}
      {purchases.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-surface-muted/60 p-3 text-center">
            <span className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Toplam Tanımlanan
            </span>
            <span className="mt-0.5 block font-heading text-2xl font-bold text-ink">
              {purchases.reduce((s, p) => s + (p.lesson_count || 0), 0)} <span className="text-xs font-normal text-muted-foreground">ders</span>
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-surface-muted/60 p-3 text-center">
            <span className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Toplam Kullanılan
            </span>
            <span className="mt-0.5 block font-heading text-2xl font-bold text-ink">
              {purchases.reduce((s, p) => s + (p.lessons_used || 0), 0)} <span className="text-xs font-normal text-muted-foreground">ders</span>
            </span>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center">
            <span className="block text-[11px] font-semibold text-primary uppercase tracking-wider">
              Toplam Kalan
            </span>
            <span className="mt-0.5 block font-heading text-2xl font-bold text-primary">
              {purchases
                .filter((p) => p.status === "active" && p.lesson_count - p.lessons_used > 0)
                .reduce((s, p) => s + Math.max(0, p.lesson_count - p.lessons_used), 0)}{" "}
              <span className="text-xs font-normal text-primary/80">ders</span>
            </span>
          </div>
        </div>
      )}

      {/* 1. AKTİF PAKETLER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-heading text-sm font-bold text-ink uppercase tracking-wider">
            Aktif Paketler ({purchases.filter((p) => p.status === "active" && (p.lesson_count || 0) - (p.lessons_used || 0) > 0).length})
          </h4>
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
              const title = p.custom_package_name || p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id;

              return (
                <div key={p.id} className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-3.5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-ink">{title}</h4>
                        {extraLessonsSum > 0 && (
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            +{extraLessonsSum} Ek Ders
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.start_date}
                        {p.end_date ? ` — ${p.end_date}` : " (Süresiz)"}
                        {p.price_amount !== null ? ` · ${money(p.price_amount, p.currency)}` : ""}
                        {p.custom_package_name ? " · Özel Paket" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold">
                        Aktif
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAdjustmentModal(p.id, "add")}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer transition-colors"
                        >
                          <Plus className="size-3" />
                          Ders Hakkı Ekle
                        </button>
                        <button
                          type="button"
                          disabled={remaining <= 0}
                          onClick={() => openAdjustmentModal(p.id, "remove")}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer transition-colors"
                        >
                          <Minus className="size-3" />
                          Ders Hakkı Azalt
                        </button>
                        {/* Manuel bilgilendirme: paket tanımlama ve hak
                            değişikliği kendi başına e-posta göndermez. */}
                        <button
                          type="button"
                          disabled={mailSendingKey === `${p.id}:package_assigned`}
                          onClick={() => void sendPackageMail(p.id, "package_assigned")}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <Mail className="size-3 text-primary" />
                          {mailButtonLabel(p.id, "package_assigned")}
                        </button>
                        <button
                          type="button"
                          disabled={mailSendingKey === `${p.id}:lesson_rights`}
                          onClick={() => void sendPackageMail(p.id, "lesson_rights")}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <Mail className="size-3 text-primary" />
                          {mailButtonLabel(p.id, "lesson_rights")}
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
                      <span className="font-semibold text-emerald-800">
                        Kalan: <strong>{remaining} ders</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
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

                  {/* Adjustment History Timeline */}
                  {pkgAdjustments.length > 0 && (
                    <div className="mt-2 rounded-xl bg-surface-muted/70 p-3 text-[11px] space-y-2 border border-border">
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
                                        ? "-1 Geçmiş Ders Eklendi"
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
                              })} · {formatPaymentStatus(adj.payment_status)}
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
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 p-4 text-center text-xs text-muted-foreground">
            Öğrencinin aktif ders hakkı bulunan paketi bulunmamaktadır.
          </div>
        )}
      </div>

      {/* 2. ARŞİV / TAMAMLANAN PAKETLER */}
      {purchases.filter((p) => p.status !== "active" || (p.lesson_count || 0) - (p.lessons_used || 0) <= 0).length > 0 && (
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
              const title = p.custom_package_name || p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id;
              const isCompleted = p.status === "completed" || p.lessons_used >= p.lesson_count;
              const isRefunded = p.status === "refunded";
              const statusLabel = isCompleted ? "Tamamlandı / Arşiv" : isRefunded ? "İade Edildi" : "Arşiv";

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
                        {p.custom_package_name ? " · Özel Paket" : ""}
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

                  {/* Adjustment History Timeline */}
                  {pkgAdjustments.length > 0 && (
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
                                        ? "-1 Geçmiş Ders Eklendi"
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
                              })} · {formatPaymentStatus(adj.payment_status)}
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
}: {
  notes: Tables<"student_admin_notes">[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  userId: string;
  changed: () => void;
}) {
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

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
                    <p className="font-semibold text-red-900">Bu notu silmek istediğinizden emin misiniz?</p>
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
                        {actionBusy ? "Siliniyor..." : "Evet, Sil"}
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
                          title="Notu Sil"
                        >
                          <Trash2 className="size-3 text-red-600" />
                          <span>Sil</span>
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
  "min-h-9 w-full rounded-lg border border-input bg-white px-2.5 py-2 text-xs focus:border-primary focus:outline-hidden";

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
