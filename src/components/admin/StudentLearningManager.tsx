"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Mail,
  PackagePlus,
  Plus,
  Send,
  StickyNote,
  Video,
  XCircle,
} from "lucide-react";
import {
  addStudentPrivateNote,
  assignStudentPackage,
  cancelStudentLesson,
  completeStudentLesson,
  createStudentHomework,
  listStudentLearning,
  reviewStudentHomework,
  sendLessonMeetingLink,
  upsertStudentLesson,
  type PackageOption,
  type PackagePurchase,
  type StudentPayment,
} from "@/lib/admin/student-learning";
import type { Tables } from "@/types/database.types";

export type LearningSection = "lessons" | "homework" | "packages" | "payments" | "notes";

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
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", lessonId: "", fileUrl: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createStudentHomework({
      student_user_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      due_date: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      lesson_id: form.lessonId || null,
      assignment_file_url: form.fileUrl.trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setForm({ title: "", description: "", dueDate: "", lessonId: "", fileUrl: "" });
      changed();
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-2 rounded-xl border border-border bg-background-soft/40 p-3">
        <h4 className="flex items-center gap-2 text-xs font-bold">
          <ClipboardList className="size-4" />
          Ödev Ata
        </h4>
        <Input required placeholder="Başlık" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <textarea
          required
          placeholder="Açıklama"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={field}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className={field}
          />
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
        <Input
          placeholder="Dosya bağlantısı (isteğe bağlı)"
          value={form.fileUrl}
          onChange={(v) => setForm({ ...form, fileUrl: v })}
        />
        <Submit busy={busy}>Ödevi Ata</Submit>
      </form>
      <div className="space-y-2">
        {homework.length ? (
          homework.map((h) => <HomeworkReview key={h.id} item={h} changed={changed} />)
        ) : (
          <Empty>Henüz ödev yok.</Empty>
        )}
      </div>
    </div>
  );
}

function HomeworkReview({ item, changed }: { item: Tables<"student_homework">; changed: () => void }) {
  const [feedback, setFeedback] = useState(item.teacher_feedback || "");
  return (
    <Card>
      <div className="flex justify-between gap-2">
        <strong>{item.title}</strong>
        <Badge>{item.status}</Badge>
      </div>
      <p>{item.description}</p>
      {item.assignment_file_url && (
        <a className="text-primary underline" href={item.assignment_file_url} target="_blank" rel="noreferrer">
          Atama dosyası
        </a>
      )}
      {item.submission_text && <p className="mt-2 rounded bg-white p-2">Öğrenci yanıtı: {item.submission_text}</p>}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Geri bildirim"
        className={`${field} mt-2`}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            await reviewStudentHomework(item.id, "reviewed", feedback);
            changed();
          }}
          className="rounded border border-border px-2 py-1 cursor-pointer"
        >
          İncelendi
        </button>
        <button
          onClick={async () => {
            await reviewStudentHomework(item.id, "completed", feedback);
            changed();
          }}
          className="rounded bg-ink px-2 py-1 text-white cursor-pointer"
        >
          Tamamlandı
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
  userId,
  busy,
  setBusy,
  setError,
  changed,
}: {
  purchases: PackagePurchase[];
  packages: PackageOption[];
  userId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  changed: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    packageId: "",
    startDate: today,
    endDate: "",
    lessonCount: "",
    price: "",
    currency: "TRY",
    paymentStatus: "pending" as "pending" | "waived",
  });
  const selected = packages.find((p) => p.id === form.packageId);

  function choose(id: string) {
    const p = packages.find((x) => x.id === id);
    setForm({
      ...form,
      packageId: id,
      lessonCount: String(p?.lesson_count || ""),
      price: String(p?.current_total ?? p?.price_amount ?? ""),
      currency: p?.currency || "TRY",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await assignStudentPackage({
      studentId: userId,
      packageId: form.packageId,
      startDate: form.startDate,
      endDate: form.endDate || null,
      lessonCount: Number(form.lessonCount),
      priceAmount: Number(form.price),
      currency: form.currency,
      paymentStatus: form.paymentStatus,
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else changed();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-2 rounded-xl border border-border bg-background-soft/40 p-3">
        <h4 className="flex items-center gap-2 text-xs font-bold">
          <PackagePlus className="size-4" />
          Manuel Paket Ata
        </h4>
        <select required value={form.packageId} onChange={(e) => choose(e.target.value)} className={field}>
          <option value="">Paket seçin</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name_tr || p.name_en || p.id}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            required
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className={field}
          />
          <input
            type="date"
            min={form.startDate}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className={field}
          />
          <Input
            required
            type="number"
            placeholder="Ders sayısı"
            value={form.lessonCount}
            onChange={(v) => setForm({ ...form, lessonCount: v })}
          />
          <Input
            required
            type="number"
            placeholder="Ücret"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
          />
          <Input
            required
            placeholder="Para birimi"
            value={form.currency}
            onChange={(v) => setForm({ ...form, currency: v.toUpperCase() })}
          />
          <select
            value={form.paymentStatus}
            onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as "pending" | "waived" })}
            className={field}
          >
            <option value="pending">Ödeme bekliyor</option>
            <option value="waived">Ücretsiz / Muaf</option>
          </select>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Manuel atama “ödendi” olarak kaydedilemez. Havale ödemesi Ödemeler ekranında ayrıca onaylanmalıdır.
        </p>
        <Submit busy={busy} disabled={!selected}>
          Paketi Ata
        </Submit>
      </form>
      <div className="space-y-2">
        {purchases.length ? (
          purchases.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between gap-2">
                <strong>{p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.package_id}</strong>
                <Badge>{p.status}</Badge>
              </div>
              <p>
                {p.lessons_used}/{p.lesson_count} ders · {Math.max(0, p.lesson_count - p.lessons_used)} kalan ·{" "}
                {p.payment_status}
              </p>
              <p>
                {p.start_date}
                {p.end_date ? ` — ${p.end_date}` : ""}
                {p.price_amount !== null ? ` · ${money(p.price_amount, p.currency)}` : ""}
              </p>
            </Card>
          ))
        ) : (
          <Empty>Atanmış paket yok.</Empty>
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
