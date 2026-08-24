"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import {
  getAdminHomeworkDetail,
  openHomeworkAttachment,
  reviewInteractiveHomework,
  sendHomeworkEmail,
  type HomeworkDetail,
} from "@/lib/homework";

export function SubmissionGradingModal({
  homeworkId,
  onClose,
  onGraded,
}: {
  homeworkId: string;
  onClose: () => void;
  onGraded: () => void;
}) {
  const [detail, setDetail] = useState<HomeworkDetail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminHomeworkDetail(homeworkId).then((res) => {
      if (res.error) setError(res.error);
      else {
        setDetail(res.data);
        setFeedback(String(res.data?.homework.teacher_feedback || ""));
      }
      setLoading(false);
    });
  }, [homeworkId]);

  const handleReview = async (reopen: boolean) => {
    setBusy(true);
    setError("");

    const res = await reviewInteractiveHomework(homeworkId, feedback, reopen);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }

    // Send transaction email
    if (reopen) {
      void sendHomeworkEmail({ action: "revision_requested", homeworkId });
    } else {
      void sendHomeworkEmail({ action: "reviewed", homeworkId });
    }

    setBusy(false);
    onGraded();
    onClose();
  };

  // Calculate quick MCQ score stats
  let mcqTotal = 0;
  let mcqCorrect = 0;
  if (detail?.questions) {
    detail.questions.forEach((q) => {
      if (q.question_type === "multiple_choice") {
        mcqTotal++;
        const ans = detail.answers.find((a) => a.question_id === q.id);
        const sel = q.options.find((o) => o.id === ans?.selected_option_id);
        const cor = q.options.find((o) => o.is_correct);
        if (sel && cor && sel.id === cor.id) mcqCorrect++;
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-3xl rounded-3xl border border-border bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="size-5 text-[#819586]" />
            <div>
              <h2 className="text-base font-bold text-ink">Ödev Değerlendirme & Yanıtlar</h2>
              {detail && (
                <p className="text-xs text-muted-foreground">
                  {detail.homework.student_name} — {detail.assignment.title}
                </p>
              )}
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
          <div className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Yanıtlar ve teslim dosyaları yükleniyor...
          </div>
        ) : !detail ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Ödev detayları bulunamadı.
          </div>
        ) : (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header Stats Bar */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface-muted/30 p-4 sm:grid-cols-4">
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                  Öğrenci
                </span>
                <span className="text-xs font-bold text-ink">
                  {detail.homework.student_name || "Öğrenci"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                  Durum
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 uppercase">
                  {detail.homework.status === "submitted"
                    ? "Teslim Edildi"
                    : detail.homework.status === "reviewed"
                    ? "Değerlendirildi"
                    : detail.homework.status}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                  Teslim Tarihi
                </span>
                <span className="text-xs text-muted-foreground">
                  {detail.homework.submitted_at
                    ? new Date(detail.homework.submitted_at).toLocaleString("tr-TR")
                    : "—"}
                </span>
              </div>
              {mcqTotal > 0 && (
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                    Çoktan Seçmeli
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {mcqCorrect} / {mcqTotal} Doğru
                  </span>
                </div>
              )}
            </div>

            {/* Questions & Responses */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Soru Yanıtları ({detail.questions.length})
              </h3>

              {detail.questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Bu ödevde etkileşimli soru bulunmuyor.
                </div>
              ) : (
                detail.questions.map((q, idx) => {
                  const ans = detail.answers.find((a) => a.question_id === q.id);
                  const selected = q.options.find((o) => o.id === ans?.selected_option_id);
                  const correct = q.options.find((o) => o.is_correct);
                  const isCorrect = Boolean(
                    selected && correct && selected.id === correct.id
                  );

                  return (
                    <article
                      key={q.id || idx}
                      className="rounded-2xl border border-border bg-white p-4 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold text-ink">
                          <span className="font-bold mr-1">{idx + 1}.</span>
                          {q.prompt}
                        </div>
                        {q.question_type === "multiple_choice" && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isCorrect
                                ? "bg-emerald-100 text-emerald-800"
                                : selected
                                ? "bg-red-100 text-red-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {isCorrect ? (
                              <>
                                <CheckCircle2 className="size-3" /> Doğru
                              </>
                            ) : selected ? (
                              <>
                                <XCircle className="size-3" /> Yanlış
                              </>
                            ) : (
                              "Boş"
                            )}
                          </span>
                        )}
                      </div>

                      {q.question_type === "multiple_choice" ? (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
                          {q.options.map((opt) => {
                            const isUserPick = selected?.id === opt.id;
                            const isRight = opt.is_correct;
                            return (
                              <div
                                key={opt.id || opt.option_key}
                                className={`flex items-center gap-2 rounded-xl border p-2.5 ${
                                  isRight
                                    ? "border-emerald-400 bg-emerald-50 text-emerald-950 font-semibold"
                                    : isUserPick
                                    ? "border-red-300 bg-red-50 text-red-950"
                                    : "border-border bg-surface-muted/30 text-muted-foreground"
                                }`}
                              >
                                <span
                                  className={`flex size-5 items-center justify-center rounded text-[10px] font-bold ${
                                    isRight
                                      ? "bg-emerald-600 text-white"
                                      : isUserPick
                                      ? "bg-red-500 text-white"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {opt.option_key}
                                </span>
                                <span>{opt.option_text}</span>
                                {isUserPick && (
                                  <span className="ml-auto text-[10px] font-bold uppercase text-muted-foreground">
                                    (Öğrenci Yanıtı)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-border bg-surface-muted/50 p-3 text-xs">
                            <span className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                              Öğrencinin Cevabı:
                            </span>
                            <p className="whitespace-pre-wrap text-ink font-medium">
                              {ans?.answer_text || "— Yanıt verilmemiş —"}
                            </p>
                          </div>
                          {q.reference_answer && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 text-[11px] text-emerald-900">
                              <span className="font-bold">Öğretmen Referans Cevabı: </span>
                              {q.reference_answer}
                            </div>
                          )}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="text-[11px] text-muted-foreground italic border-t border-border pt-2">
                          <span className="font-semibold text-ink not-italic">Çözüm / Not: </span>
                          {q.explanation}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            {/* Uploaded Submission Files */}
            {detail.attachments.filter((a) => a.attachment_kind === "submission").length >
              0 && (
              <div className="space-y-2 rounded-2xl border border-border bg-surface-muted/30 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Öğrenci Tarafından Yüklenen Dosyalar
                </h4>
                <div className="flex flex-wrap gap-2">
                  {detail.attachments
                    .filter((a) => a.attachment_kind === "submission")
                    .map((file) => (
                      <button
                        type="button"
                        key={file.id}
                        onClick={() => void openHomeworkAttachment(file.storage_path)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                      >
                        <Download className="size-4 text-primary" />
                        {file.file_name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Instructor Feedback Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-muted-foreground mb-1">
                Eğitmen Geri Bildirimi & Notu
              </label>
              <textarea
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Öğrenciye iletilecek değerlendirme yorumları ve önerilerinizi buraya yazınız..."
                className="w-full rounded-2xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
              >
                Kapat
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleReview(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" />
                  Düzenleme / Revizyon İste
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleReview(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  {busy ? "Kaydediliyor..." : "Değerlendirildi Olarak İşaretle"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
