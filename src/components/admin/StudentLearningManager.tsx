"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  PackagePlus,
  Plus,
  Send,
  StickyNote,
  Trash2,
  Upload,
  Video,
  XCircle,
  Sparkles,
  History,
  Check,
  RotateCcw,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  addStudentPrivateNote,
  assignStudentPackage,
  addStudentExtraLessons,
  cancelStudentLesson,
  completeStudentLesson,
  createStudentHomework,
  listStudentLearning,
  reviewStudentHomework,
  sendLessonMeetingLink,
  upsertStudentLesson,
  type PackageOption,
  type PackagePurchase,
  type PackageAdjustment,
  type StudentPayment,
} from "@/lib/admin/student-learning";
import type { Tables } from "@/types/database.types";
import { listStudentExamAttempts, type StudentExamAttempt } from "@/lib/student/exam-history";
import { ExamQuestionReview } from "@/components/exam-test/ExamQuestionReview";

export type LearningSection = "lessons" | "homework" | "packages" | "payments" | "notes" | "exam_history";

export function StudentLearningManager({
  userId,
  section,
  onChanged,
}: {
  userId: string;
  section: LearningSection;
  onChanged?: () => void;
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
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        changed={changed}
      />
    );
  }

  if (section === "homework") {
    return (
      <HomeworkPanel
        homework={homework}
        lessons={lessons}
        userId={userId}
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
                <Badge>{p.status}</Badge>
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
        <p className="text-[11px] text-muted-foreground">
          Bekleyen manuel havaleler yalnızca Ödemeler ekranındaki açık onay işlemiyle ödendi durumuna geçer.
        </p>
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
  busy,
  setBusy,
  setError,
  changed,
}: {
  lessons: Tables<"student_lessons">[];
  purchases: PackagePurchase[];
  userId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Tables<"student_lessons"> | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const activePackage = purchases.find((p) => p.status === "active") || purchases[0];

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

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setActionSuccess(null);

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
      setIsCreating(false);
      setActionSuccess("Canlı ders başarıyla planlandı.");
      // If meeting url provided, send link email automatically or inform
      if (res.success && form.liveMeetingUrl.trim()) {
        setActionSuccess("Canlı ders başarıyla planlandı. Bağlantıyı öğrenciye gönderebilirsiniz.");
      }
      changed();
    }
  }

  async function handleSendLink(lesson: Tables<"student_lessons">) {
    if (!lesson.live_meeting_url) {
      setError("Ders için tanımlı bir canlı ders bağlantısı bulunmuyor.");
      return;
    }
    setBusy(true);
    setError("");
    setActionSuccess(null);
    const res = await sendLessonMeetingLink(lesson.id);
    setBusy(false);
    if (!res.success) {
      setError(res.error || "Bağlantı e-postası gönderilemedi.");
    } else {
      setActionSuccess(`Canlı ders bağlantısı öğrenciye başarıyla gönderildi.`);
      changed();
    }
  }

  async function handleConfirmComplete() {
    if (!completeTarget) return;
    setBusy(true);
    setError("");
    setActionSuccess(null);

    const res = await completeStudentLesson({
      lessonId: completeTarget.id,
      packagePurchaseId: completeTarget.package_purchase_id,
      teacherNote: completionNote.trim() || null,
    });

    setBusy(false);
    setCompleteTarget(null);
    setCompletionNote("");

    if (!res.success) {
      setError(res.error || "Ders tamamlanamadı.");
    } else {
      setActionSuccess(
        res.alreadyCompleted
          ? "Ders zaten tamamlanmış olarak işaretliydi."
          : "Ders başarıyla tamamlandı, paketten 1 ders düşüldü ve öğrenciye bilgilendirme e-postası gönderildi."
      );
      changed();
    }
  }

  async function handleCancelLesson(lessonId: string) {
    if (!confirm("Bu dersi iptal etmek istediğinizden emin misiniz?")) return;
    setBusy(true);
    setError("");
    const res = await cancelStudentLesson(lessonId, "Yönetici tarafından iptal edildi.");
    setBusy(false);
    if (!res.success) setError(res.error || "İptal edilemedi.");
    else {
      setActionSuccess("Ders iptal edildi.");
      changed();
    }
  }

  function copyUrl(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* Top Header & Add Live Lesson Button */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
          <Video className="size-4 text-primary" />
          Canlı Dersler ve Ders Geçmişi ({lessons.length})
        </h4>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer"
        >
          <Plus className="size-3.5" />
          {isCreating ? "Formu Kapat" : "Yeni Canlı Ders Planla"}
        </button>
      </div>

      {/* New Live Lesson Form */}
      {isCreating && (
        <form onSubmit={handleCreateLesson} className="grid gap-3 rounded-xl border border-primary/20 bg-surface p-4 text-xs shadow-xs">
          <div className="font-bold text-ink">Canlı Ders Planla</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Ders Başlığı</label>
              <Input required placeholder="Örn: Birebir Matematik Dersi" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Konu / Alan</label>
              <Input required placeholder="Örn: SAT Math / Calculus" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Sınav Kodu</label>
              <Input placeholder="SAT, IB, AP, ESAT vb." value={form.examCode} onChange={(v) => setForm({ ...form, examCode: v })} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tarih & Saat</label>
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
              <Input required type="number" placeholder="60" value={String(form.durationMinutes)} onChange={(v) => setForm({ ...form, durationMinutes: Number(v) || 60 })} />
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
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id} ({p.lessons_used}/{p.lesson_count} ders kullanıldı)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Canlı Ders Bağlantısı (Google Meet / Zoom URL)</label>
              <Input
                placeholder="https://meet.google.com/abc-defg-hij"
                value={form.liveMeetingUrl}
                onChange={(v) => setForm({ ...form, liveMeetingUrl: v })}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Eğitmen Notu / Hazırlık Yönergesi (İsteğe bağlı)</label>
            <textarea
              placeholder="Öğrencinin derse hazır getirmesi gereken materyaller veya notlar..."
              value={form.teacherNote}
              onChange={(e) => setForm({ ...form, teacherNote: e.target.value })}
              className={field}
            />
          </div>
          <div className="flex gap-2">
            <Submit busy={busy}>Dersi Kaydet & Planla</Submit>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-surface-muted cursor-pointer"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Confirmation Modal for Marking Lesson Completed */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="size-6 shrink-0" />
              <h3 className="font-heading text-lg text-ink font-bold">Dersi Tamamlandı Olarak İşaretle</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-5">
              <strong>{completeTarget.title}</strong> dersini tamamlandı olarak kaydetmek üzeresiniz.
            </p>
            <div className="rounded-lg bg-surface-muted p-3 text-xs space-y-1 text-ink/80">
              <div>• Öğrencinin ilişkili paketinden <strong>1 ders hakkı güvenli şekilde düşülecektir</strong>.</div>
              <div>• Öğrenciye <strong>&ldquo;Dersiniz Tamamlandı&rdquo;</strong> bilgilendirme e-postası iletilecektir.</div>
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCompleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted cursor-pointer"
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
                          rel="noreferrer"
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
                          rel="noreferrer"
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
                        disabled={busy}
                        onClick={() => handleSendLink(l)}
                        className="inline-flex items-center gap-1 text-primary font-semibold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        <Send className="size-3" />
                        {l.meeting_link_sent_at ? "Bağlantıyı Tekrar Gönder" : "Linki Öğrenciye E-posta İle Gönder"}
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
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
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
  busy,
  setBusy,
  setError,
  changed,
}: {
  homework: Tables<"student_homework">[];
  lessons: Tables<"student_lessons">[];
  userId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    lessonId: "",
    fileUrl: "",
  });
  const [resourceType, setResourceType] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; file?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".webp"];
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  function validateFile(file: File): string | null {
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return "Yalnızca PDF, Word, PowerPoint, Excel ve görsel dosyaları yüklenebilir.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Dosya boyutu 20 MB sınırını aşamaz.";
    }
    return null;
  }

  function handleFileSelect(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      setErrors((prev) => ({ ...prev, file: undefined }));
      return;
    }
    const err = validateFile(file);
    if (err) {
      setErrors((prev) => ({ ...prev, file: err }));
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
      setErrors((prev) => ({ ...prev, file: undefined }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { title?: string; description?: string; file?: string } = {};

    if (!form.title.trim()) {
      newErrors.title = "Başlık gereklidir.";
    }
    if (!form.description.trim()) {
      newErrors.description = "Açıklama gereklidir.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setBusy(true);
    setError("");

    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentSize: number | null = null;
    let attachmentMime: string | null = null;

    if (resourceType === "file" && selectedFile) {
      setUploading(true);
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${userId}/${Date.now()}_${cleanFileName}`;

      const { error: uploadError } = await getSupabaseClient()
        .storage
        .from("homework-attachments")
        .upload(filePath, selectedFile, { upsert: true });

      setUploading(false);

      if (uploadError) {
        setBusy(false);
        setError(`Dosya yüklenemedi: ${uploadError.message}`);
        return;
      }

      attachmentPath = filePath;
      attachmentName = selectedFile.name;
      attachmentSize = selectedFile.size;
      attachmentMime = selectedFile.type || "application/octet-stream";
    }

    const { error: homeworkError } = await createStudentHomework({
      student_user_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      due_date: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      lesson_id: form.lessonId || null,
      assignment_file_url: resourceType === "url" ? form.fileUrl.trim() || null : null,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
      attachment_mime: attachmentMime,
    });

    setBusy(false);
    if (homeworkError) {
      setError(homeworkError.message);
    } else {
      setForm({ title: "", description: "", dueDate: "", lessonId: "", fileUrl: "" });
      setSelectedFile(null);
      setErrors({});
      changed();
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      <form
        noValidate
        onSubmit={submit}
        className="grid gap-3.5 rounded-2xl border border-border bg-background-soft/40 p-4 shadow-xs text-xs"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <h4 className="flex items-center gap-2 font-bold text-ink text-sm">
            <ClipboardList className="size-4 text-primary" />
            Ödev Ata
          </h4>
        </div>

        {/* Title Field with Inline Validation */}
        <div className="space-y-1">
          <label className="block font-semibold text-muted-foreground">
            Başlık <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => {
              setForm({ ...form, title: e.target.value });
              if (errors.title) setErrors({ ...errors, title: undefined });
            }}
            placeholder="Örn: SAT Math / Geometri Çalışması"
            aria-invalid={Boolean(errors.title)}
            className={`min-h-9 w-full rounded-lg border bg-white px-3 text-xs outline-hidden transition-colors ${
              errors.title
                ? "border-red-400 bg-red-50/30 focus:border-red-500"
                : "border-input focus:border-primary"
            }`}
          />
          {errors.title && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
              <AlertCircle className="size-3 shrink-0" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Description Field with Inline Validation */}
        <div className="space-y-1">
          <label className="block font-semibold text-muted-foreground">
            Açıklama / Yönergeler <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
            placeholder="Ödev detayları, çözülmesi gereken sorular veya yönergeler..."
            aria-invalid={Boolean(errors.description)}
            className={`w-full rounded-lg border bg-white p-3 text-xs outline-hidden transition-colors ${
              errors.description
                ? "border-red-400 bg-red-50/30 focus:border-red-500"
                : "border-input focus:border-primary"
            }`}
          />
          {errors.description && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
              <AlertCircle className="size-3 shrink-0" />
              {errors.description}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block font-semibold text-muted-foreground">Son Teslim Tarihi & Saati</label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={field}
            />
          </div>
          <div className="space-y-1">
            <label className="block font-semibold text-muted-foreground">İlişkili Canlı Ders (İsteğe Bağlı)</label>
            <select
              value={form.lessonId}
              onChange={(e) => setForm({ ...form, lessonId: e.target.value })}
              className={field}
            >
              <option value="">Ders bağlantısı yok</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({new Date(l.lesson_date).toLocaleDateString("tr-TR")})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resource Attachment Section */}
        <div className="space-y-2 rounded-xl border border-border/80 bg-surface-muted/50 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              Dosya / Kaynak Ekle (İsteğe Bağlı)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setResourceType("file")}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  resourceType === "file"
                    ? "bg-primary text-white"
                    : "bg-white text-muted-foreground hover:text-ink"
                }`}
              >
                Dosya Yükle
              </button>
              <button
                type="button"
                onClick={() => setResourceType("url")}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  resourceType === "url"
                    ? "bg-primary text-white"
                    : "bg-white text-muted-foreground hover:text-ink"
                }`}
              >
                Harici Bağlantı (URL)
              </button>
            </div>
          </div>

          {resourceType === "file" ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 text-primary shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-ink block truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatBytes(selectedFile.size)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFileSelect(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Dosyayı kaldır"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-forest/5 transition-colors"
                >
                  <Upload className="size-5 text-muted-foreground mb-1" />
                  <p className="text-xs font-semibold text-ink">
                    Dosya seçin veya buraya sürükleyip bırakın
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    PDF, DOC, DOCX, PPT, XLS, Görsel (Maks. 20 MB)
                  </p>
                </div>
              )}

              {errors.file && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors.file}
                </p>
              )}
            </div>
          ) : (
            <div>
              <input
                type="url"
                placeholder="https://drive.google.com/... veya dosya bağlantısı"
                value={form.fileUrl}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                className={field}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Submit busy={busy || uploading}>
            {uploading ? "Dosya Yükleniyor..." : "Ödevi Ata"}
          </Submit>
        </div>
      </form>

      <div className="space-y-2.5">
        <h5 className="text-xs font-bold text-ink">Atanan Ödevler ({homework.length})</h5>
        {homework.length ? (
          homework.map((h) => <HomeworkReview key={h.id} item={h} changed={changed} />)
        ) : (
          <Empty>Henüz ödev kaydı bulunmuyor.</Empty>
        )}
      </div>
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
  const [feedback, setFeedback] = useState(item.teacher_feedback || "");
  const [downloading, setDownloading] = useState(false);
  const [subDownloading, setSubDownloading] = useState(false);
  const [busy, setBusy] = useState(false);

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
              rel="noreferrer"
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

      <div className="mt-3 space-y-1.5">
        <label className="block text-[11px] font-semibold text-muted-foreground">
          Eğitmen Geri Bildirimi / Değerlendirme
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Öğrenci için değerlendirme notu..."
          className={`${field} min-h-16`}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await reviewStudentHomework(item.id, "reviewed", feedback);
            setBusy(false);
            changed();
          }}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted cursor-pointer disabled:opacity-50"
        >
          {busy ? "İşleniyor..." : "İncelendi Olarak İşaretle"}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await reviewStudentHomework(item.id, "completed", feedback);
            setBusy(false);
            changed();
          }}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
        >
          {busy ? "İşleniyor..." : "Tamamlandı Olarak İşaretle"}
        </button>
      </div>
    </Card>
  );
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
  const today = new Date().toISOString().slice(0, 10);
  const [activeModal, setActiveModal] = useState<"none" | "assign_package" | "extra_lessons">("none");
  const [targetPurchaseId, setTargetPurchaseId] = useState<string>("");

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
    sendNotification: true,
  });

  // Extra Lessons Form State
  const [extraForm, setExtraForm] = useState({
    purchaseId: "",
    lessonDelta: "3",
    price: "0",
    currency: "TRY",
    paymentStatus: "waived" as "pending" | "paid" | "waived",
    notes: "",
    sendNotification: true,
  });

  // Pick default purchase for extra lessons
  const defaultPurchase = purchases.find((p) => p.status === "active") || purchases[0];
  const selectedExtraPurchase = purchases.find((p) => p.id === (extraForm.purchaseId || targetPurchaseId)) || defaultPurchase;

  function openAssignModal() {
    setActiveModal("assign_package");
  }

  function openExtraModal(purchaseId?: string) {
    const pId = purchaseId || defaultPurchase?.id || "";
    setTargetPurchaseId(pId);
    setExtraForm((prev) => ({
      ...prev,
      purchaseId: pId,
      currency: purchases.find((x) => x.id === pId)?.currency || "TRY",
    }));
    setActiveModal("extra_lessons");
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
      currency: packageForm.currency.toUpperCase(),
      paymentStatus: packageForm.paymentStatus,
      adminNotes: packageForm.adminNotes.trim() || null,
      sendNotification: packageForm.sendNotification,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      setActiveModal("none");
      changed();
    }
  }

  async function handleExtraSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExtraPurchase) return;
    const delta = Number(extraForm.lessonDelta);
    if (delta < 1) {
      setError("Ek ders sayısı en az 1 olmalıdır.");
      return;
    }
    setBusy(true);
    const res = await addStudentExtraLessons({
      purchaseId: selectedExtraPurchase.id,
      studentId: userId,
      lessonDelta: delta,
      priceAmount: Number(extraForm.price || 0),
      currency: extraForm.currency.toUpperCase(),
      paymentStatus: extraForm.paymentStatus,
      notes: extraForm.notes.trim() || null,
      sendNotification: extraForm.sendNotification,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      setActiveModal("none");
      changed();
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-ink">Eğitim Paketleri & Ders Hakları</h3>
          <p className="text-xs text-muted-foreground">
            Öğrencinin kayıtlı paketlerini yönetin, yeni paket tanımlayın veya mevcut pakete ek ders ekleyin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAssignModal}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors"
          >
            <PackagePlus className="size-3.5" />
            Paket Tanımla
          </button>
          <button
            type="button"
            disabled={purchases.length === 0}
            onClick={() => openExtraModal()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
          >
            <Plus className="size-3.5" />
            Ek Ders Ekle
          </button>
        </div>
      </div>

      {/* MODAL: Paket Tanımla */}
      {activeModal === "assign_package" && (
        <div className="rounded-2xl border-2 border-primary/30 bg-white p-5 shadow-editorial space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
              <PackagePlus className="size-4 text-primary" />
              Yeni Paket Tanımla
            </h4>
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              className="text-xs font-semibold text-muted-foreground hover:text-ink cursor-pointer"
            >
              Kapat ✕
            </button>
          </div>

          <form onSubmit={handleAssignSubmit} className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignMode("catalog")}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  assignMode === "catalog"
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                }`}
              >
                Katalog Paketi (Standart)
              </button>
              <button
                type="button"
                onClick={() => setAssignMode("custom")}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                  assignMode === "custom"
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface-muted text-muted-foreground hover:bg-white"
                }`}
              >
                Özel Tanımlı Paket
              </button>
            </div>

            {assignMode === "catalog" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Paket Seçin</label>
                  <select
                    required
                    value={packageForm.packageId}
                    onChange={(e) => chooseCatalogPackage(e.target.value)}
                    className={field}
                  >
                    <option value="">Seçiniz...</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_tr || p.name_en || p.id} ({p.lesson_count} Ders · {money(Number(p.current_total ?? p.price_amount ?? 0), "TRY")})
                      </option>
                    ))}
                  </select>
                </div>

                {packageForm.packageId && (
                  <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-forest/5 p-3 text-xs">
                    <span className="font-semibold text-ink">Seçilen Paket Özeti:</span>
                    <span className="font-bold text-primary">
                      {packageForm.lessonCount} Ders · {money(Number(packageForm.price || 0), "TRY")}
                    </span>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Başlangıç Tarihi</label>
                    <input
                      required
                      type="date"
                      value={packageForm.startDate}
                      onChange={(e) => setPackageForm({ ...packageForm, startDate: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Bitiş Tarihi (Opsiyonel)</label>
                    <input
                      type="date"
                      min={packageForm.startDate}
                      value={packageForm.endDate}
                      onChange={(e) => setPackageForm({ ...packageForm, endDate: e.target.value })}
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
                    <option value="waived">Ücretsiz / Muaf</option>
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
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Başlangıç Tarihi</label>
                    <input
                      required
                      type="date"
                      value={packageForm.startDate}
                      onChange={(e) => setPackageForm({ ...packageForm, startDate: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Bitiş Tarihi (Opsiyonel)</label>
                    <input
                      type="date"
                      min={packageForm.startDate}
                      value={packageForm.endDate}
                      onChange={(e) => setPackageForm({ ...packageForm, endDate: e.target.value })}
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
                    <option value="waived">Ücretsiz / Muaf</option>
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

            <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={packageForm.sendNotification}
                onChange={(e) => setPackageForm({ ...packageForm, sendNotification: e.target.checked })}
                className="rounded border-input text-primary focus:ring-primary"
              />
              Öğrenciye e-posta bildirimi gönder (payments@oriens-academy.com üzerinden)
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={busy || (assignMode === "catalog" && !packageForm.packageId) || (assignMode === "custom" && !packageForm.customName.trim())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
              >
                <Check className="size-3.5" />
                {busy ? "Kaydediliyor..." : "Paketi Tanımla"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Ek Ders Ekle */}
      {activeModal === "extra_lessons" && selectedExtraPurchase && (
        <div className="rounded-2xl border-2 border-primary/30 bg-white p-5 shadow-editorial space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sparkles className="size-4 text-primary" />
              Pakete Ek Ders Ekle
            </h4>
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              className="text-xs font-semibold text-muted-foreground hover:text-ink cursor-pointer"
            >
              Kapat ✕
            </button>
          </div>

          <form onSubmit={handleExtraSubmit} className="space-y-4">
            {purchases.length > 1 && (
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Hedef Paket</label>
                <select
                  value={extraForm.purchaseId || selectedExtraPurchase.id}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setExtraForm({
                      ...extraForm,
                      purchaseId: pId,
                      currency: "TRY",
                    });
                  }}
                  className={field}
                >
                  {purchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.custom_package_name || p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id} ({p.lessons_used}/{p.lesson_count} Ders · {p.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Current Balance Banner */}
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between font-semibold text-ink">
                <span>Mevcut Paket:</span>
                <span>{selectedExtraPurchase.custom_package_name || selectedExtraPurchase.pricing_packages?.name_tr || selectedExtraPurchase.package_id}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ders Durumu:</span>
                <span>
                  {selectedExtraPurchase.lessons_used} kullanılan / {selectedExtraPurchase.lesson_count} toplam ·{" "}
                  <strong className="text-emerald-700">{Math.max(0, selectedExtraPurchase.lesson_count - selectedExtraPurchase.lessons_used)} kalan</strong>
                </span>
              </div>
            </div>

            {/* Lesson Delta Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Eklenecek Ders Sayısı</label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {[1, 2, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setExtraForm({ ...extraForm, lessonDelta: String(num) })}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      extraForm.lessonDelta === String(num)
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface hover:bg-surface-muted text-ink"
                    }`}
                  >
                    +{num} Ders
                  </button>
                ))}
              </div>
              <input
                required
                type="number"
                min="1"
                max="100"
                placeholder="Özel ders adedi girin"
                value={extraForm.lessonDelta}
                onChange={(e) => setExtraForm({ ...extraForm, lessonDelta: e.target.value })}
                className={field}
              />
            </div>

            {/* LIVE PREVIEW BOX */}
            {Number(extraForm.lessonDelta) > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <Check className="size-3.5 text-emerald-700" />
                  Ek Ders Sonrası Hak Özeti:
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-semibold">
                  <div className="rounded-lg bg-white/80 p-2 border border-emerald-200">
                    <span className="block text-[10px] text-muted-foreground">Yeni Toplam</span>
                    <span className="text-sm font-bold text-ink">
                      {selectedExtraPurchase.lesson_count + Number(extraForm.lessonDelta)} ders
                    </span>
                  </div>
                  <div className="rounded-lg bg-white/80 p-2 border border-emerald-200">
                    <span className="block text-[10px] text-muted-foreground">Kullanılan (Sabit)</span>
                    <span className="text-sm font-bold text-ink">{selectedExtraPurchase.lessons_used} ders</span>
                  </div>
                  <div className="rounded-lg bg-emerald-100 p-2 border border-emerald-300">
                    <span className="block text-[10px] text-emerald-800">Yeni Kalan</span>
                    <span className="text-sm font-bold text-emerald-900">
                      {selectedExtraPurchase.lesson_count + Number(extraForm.lessonDelta) - selectedExtraPurchase.lessons_used} ders
                    </span>
                  </div>
                </div>
                {selectedExtraPurchase.status === "completed" && (
                  <p className="mt-2 text-[11px] font-medium text-emerald-800 flex items-center gap-1">
                    <RotateCcw className="size-3" />
                    Paket tamamlanmıştı; ek ders sonrası otomatik olarak <strong>Aktif</strong> duruma gelecektir.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Ek Ücret (TL) (Opsiyonel)</label>
                <input
                  type="number"
                  min="0"
                  value={extraForm.price}
                  onChange={(e) => setExtraForm({ ...extraForm, price: e.target.value })}
                  className={field}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Ödeme Durumu</label>
                <select
                  value={extraForm.paymentStatus}
                  onChange={(e) => setExtraForm({ ...extraForm, paymentStatus: e.target.value as "pending" | "paid" | "waived" })}
                  className={field}
                >
                  <option value="waived">Ücretsiz / Muaf (Hediye / Dahil)</option>
                  <option value="paid">Ödendi (Onaylı)</option>
                  <option value="pending">Ödeme Bekliyor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Gerekçe / Açıklama (Opsiyonel)</label>
              <input
                type="text"
                placeholder="örn. Deneme sınavı soru analiz seansı / Hediye ek ders"
                value={extraForm.notes}
                onChange={(e) => setExtraForm({ ...extraForm, notes: e.target.value })}
                className={field}
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={extraForm.sendNotification}
                onChange={(e) => setExtraForm({ ...extraForm, sendNotification: e.target.checked })}
                className="rounded border-input text-primary focus:ring-primary"
              />
              Öğrenciye e-posta bildirimi gönder (payments@oriens-academy.com üzerinden)
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={busy || Number(extraForm.lessonDelta) < 1}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="size-3.5" />
                {busy ? "Ekleniyor..." : "Ek Dersleri Tanımla"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PACKAGES LIST */}
      <div className="space-y-3">
        {purchases.length ? (
          purchases.map((p) => {
            const pkgAdjustments = adjustments.filter((a) => a.package_purchase_id === p.id);
            const remaining = Math.max(0, p.lesson_count - p.lessons_used);
            const pct = Math.min(100, p.lesson_count ? Math.round((p.lessons_used / p.lesson_count) * 100) : 0);
            const title = p.custom_package_name || p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id;

            return (
              <div key={p.id} className="rounded-2xl border border-border bg-surface p-4 text-xs space-y-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-ink">{title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {p.start_date}
                      {p.end_date ? ` — ${p.end_date}` : " (Süresiz)"}
                      {p.price_amount !== null ? ` · ${money(p.price_amount, p.currency)}` : ""}
                      {p.custom_package_name ? " · Özel Paket" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        p.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.status === "completed"
                            ? "bg-slate-100 text-slate-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.status === "active" ? "Aktif" : p.status === "completed" ? "Tamamlandı" : p.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => openExtraModal(p.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors"
                    >
                      <Plus className="size-3 text-primary" />
                      Ek Ders Ekle
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
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
                      className={`h-full rounded-full transition-all duration-300 ${
                        remaining === 0 ? "bg-slate-400" : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Info Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border text-[11px] text-muted-foreground">
                  <span>Ödeme: <strong>{p.payment_status}</strong></span>
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
                                  : `${adj.lesson_delta} Ders Düzeltmesi`}
                            </span>
                            {adj.notes && <span className="text-ink/80"> — “{adj.notes}”</span>}
                          </div>
                          <span className="text-[10px]">
                            {new Date(adj.created_at).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })} · {adj.payment_status}
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
          <Empty>Atanmış eğitim paketi bulunmuyor. Yukarıdaki “Paket Tanımla” butonundan yeni bir paket atayabilirsiniz.</Empty>
        )}
      </div>
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
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await addStudentPrivateNote(userId, note);
    setBusy(false);
    if (error) setError(error.message);
    else {
      setNote("");
      changed();
    }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-xl border border-border p-3">
        <h4 className="flex items-center gap-2 text-xs font-bold">
          <StickyNote className="size-4" />
          Özel Yönetici Notu
        </h4>
        <textarea
          required
          maxLength={5000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={field}
          placeholder="Bu not öğrenci tarafından görülemez."
        />
        <Submit busy={busy}>Not Ekle</Submit>
      </form>
      {notes.length ? (
        notes.map((n) => (
          <Card key={n.id}>
            <p className="whitespace-pre-wrap text-foreground">{n.note}</p>
            <p>{new Date(n.created_at).toLocaleString("tr-TR")}</p>
          </Card>
        ))
      ) : (
        <Empty>Özel not yok.</Empty>
      )}
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
                ✕
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

