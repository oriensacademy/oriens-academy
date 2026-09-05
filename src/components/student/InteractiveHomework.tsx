"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  MessageSquare,
  Save,
  Send,
  X,
} from "lucide-react";
import {
  getStudentHomeworkDetail,
  openHomeworkAttachment,
  saveHomeworkDraft,
  submitInteractiveHomework,
  uploadHomeworkAttachment,
  type HomeworkAnswer,
  type HomeworkDetail,
} from "@/lib/homework";
import type { StudentHomeworkRow, StudentLessonRow } from "@/lib/student/data";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

export function InteractiveHomework({
  items,
  lessons,
  userId,
  locale,
  onReload,
}: {
  items: StudentHomeworkRow[];
  lessons: StudentLessonRow[];
  userId: string;
  locale: "tr" | "en";
  onReload: () => void;
}) {
  const isTr = locale === "tr";
  const [filterTab, setFilterTab] = useState<"all" | "homework" | "materials">("all");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const raw = item as unknown as { content_type?: string };
      const type = raw.content_type || "homework";
      const isMaterial = type === "lesson_note" || type === "resource";

      if (filterTab === "homework") return !isMaterial;
      if (filterTab === "materials") return isMaterial;
      return true;
    });
  }, [items, filterTab]);

  const groups = useMemo(
    () => ({
      pending: filteredItems.filter((item) =>
        ["assigned", "in_progress", "overdue", "late"].includes(item.status)
      ),
      submitted: filteredItems.filter((item) => item.status === "submitted"),
      reviewed: filteredItems.filter((item) =>
        ["reviewed", "completed"].includes(item.status)
      ),
    }),
    [filteredItems]
  );

  return (
    <div className="space-y-6">
      {/* Category Tabs Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === "all"
                ? "bg-ink text-white shadow-xs"
                : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-ink border border-border"
            }`}
          >
            {isTr ? "Tüm İçerikler" : "All Content"} ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("homework")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === "homework"
                ? "bg-ink text-white shadow-xs"
                : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-ink border border-border"
            }`}
          >
            {isTr ? "Ödevler & Çalışmalar" : "Homework & Worksheets"} (
            {
              items.filter((i) => {
                const type = (i as unknown as { content_type?: string }).content_type || "homework";
                return type !== "lesson_note" && type !== "resource";
              }).length
            }
            )
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("materials")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === "materials"
                ? "bg-ink text-white shadow-xs"
                : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-ink border border-border"
            }`}
          >
            {isTr ? "Ders Notları & Materyaller" : "Notes & Materials"} (
            {
              items.filter((i) => {
                const type = (i as unknown as { content_type?: string }).content_type || "homework";
                return type === "lesson_note" || type === "resource";
              }).length
            }
            )
          </button>
        </div>
      </div>

      <HomeworkGroup
        title={isTr ? "Bekleyen / Aktif İçerikler" : "Active & Pending"}
        items={groups.pending}
        lessons={lessons}
        userId={userId}
        locale={locale}
        onReload={onReload}
      />
      {filterTab !== "materials" && (
        <>
          <HomeworkGroup
            title={isTr ? "Teslim Edilen Ödevler" : "Submitted Homework"}
            items={groups.submitted}
            lessons={lessons}
            userId={userId}
            locale={locale}
            onReload={onReload}
          />
          <HomeworkGroup
            title={isTr ? "Değerlendirilen Ödevler" : "Reviewed & Graded"}
            items={groups.reviewed}
            lessons={lessons}
            userId={userId}
            locale={locale}
            onReload={onReload}
          />
        </>
      )}
    </div>
  );
}

function HomeworkGroup({
  title,
  items,
  lessons,
  userId,
  locale,
  onReload,
}: {
  title: string;
  items: StudentHomeworkRow[];
  lessons: StudentLessonRow[];
  userId: string;
  locale: "tr" | "en";
  onReload: () => void;
}) {
  const isTr = locale === "tr";
  const [active, setActive] = useState<StudentHomeworkRow | null>(null);

  return (
    <section className="rounded-3xl border border-border bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="font-heading text-lg font-bold text-ink">
          {title} <span className="text-sm font-semibold text-muted-foreground">({items.length})</span>
        </h2>
      </div>

      {items.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const raw = item as unknown as { content_type?: string };
            const type = raw.content_type || "homework";
            const isMaterial = type === "lesson_note" || type === "resource";
            const lesson = lessons.find((entry) => entry.id === item.lesson_id);
            const isSubmitted = item.status === "submitted";
            const isReviewed = ["reviewed", "completed"].includes(item.status);

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-white p-4 transition-all hover:border-border/80 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            type === "lesson_note"
                              ? "bg-purple-100 text-purple-800"
                              : type === "resource"
                              ? "bg-amber-100 text-amber-800"
                              : type === "worksheet"
                              ? "bg-emerald-100 text-emerald-800"
                              : type === "mock_exam"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {type === "lesson_note"
                            ? isTr ? "Ders Notu" : "Lesson Note"
                            : type === "resource"
                            ? isTr ? "Materyal" : "Material"
                            : type === "worksheet"
                            ? isTr ? "Çalışma Kağıdı" : "Worksheet"
                            : type === "mock_exam"
                            ? isTr ? "Deneme" : "Mock Exam"
                            : isTr ? "Ödev" : "Homework"}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-ink truncate">{item.title}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-primary">
                        {lesson?.subject ||
                          lesson?.title ||
                          (locale === "tr" ? "Genel Akademik Çalışma" : "General Academic Work")}
                      </p>
                    </div>
                    <Status value={item.status} />
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-ink/75 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    <span>
                      {item.due_date
                        ? `Son Teslim: ${new Date(item.due_date).toLocaleString(
                            locale === "tr" ? "tr-TR" : "en-GB"
                          )}`
                        : locale === "tr"
                        ? isMaterial ? "Süresiz Erişim" : "Teslim tarihi belirtilmemiş"
                        : isMaterial ? "Open Access" : "No due date"}
                    </span>
                  </div>

                  {item.teacher_feedback && (
                    <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2 text-[11px] text-emerald-900 font-medium">
                      <strong>Eğitmen Geri Bildirimi: </strong>
                      <span className="line-clamp-1">{item.teacher_feedback}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
                  >
                    <BookOpen className="size-3.5" />
                    {isMaterial
                      ? locale === "tr"
                        ? "Ders Notunu Oku"
                        : "Read Notes"
                      : isReviewed
                      ? locale === "tr"
                        ? "Değerlendirmeyi Gör"
                        : "View Feedback"
                      : isSubmitted
                      ? locale === "tr"
                        ? "Teslimi Görüntüle"
                        : "View Submission"
                      : locale === "tr"
                      ? "Ödevi Aç & Çöz"
                      : "Open Assignment"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-6 text-center text-xs text-muted-foreground">
          {locale === "tr" ? "Bu bölümde ödev kaydı bulunmuyor." : "No homework in this section."}
        </p>
      )}

      {active && (
        <HomeworkDetailDialog
          item={active}
          userId={userId}
          locale={locale}
          onClose={() => setActive(null)}
          onReload={onReload}
        />
      )}
    </section>
  );
}

function HomeworkDetailDialog({
  item,
  userId,
  locale,
  onClose,
  onReload,
}: {
  item: StudentHomeworkRow;
  userId: string;
  locale: "tr" | "en";
  onClose: () => void;
  onReload: () => void;
}) {
  const isTr = locale === "tr";
  const [detail, setDetail] = useState<HomeworkDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, HomeworkAnswer>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  useEffect(() => {
    let active = true;
    getStudentHomeworkDetail(item.id).then((result) => {
      if (!active) return;
      setDetail(result.data);
      setMessage(result.error || "");
      if (result.data) {
        setAnswers(
          Object.fromEntries(result.data.answers.map((answer) => [answer.question_id, answer]))
        );
      }
    });
    return () => {
      active = false;
    };
  }, [item.id]);

  useEffect(() => {
    const unlockBodyScroll = lockBodyScroll();
    return unlockBodyScroll;
  }, []);

  const rawItem = item as unknown as { content_type?: string };
  const isMaterial =
    rawItem.content_type === "lesson_note" ||
    rawItem.content_type === "resource" ||
    detail?.assignment.content_type === "lesson_note" ||
    detail?.assignment.content_type === "resource" ||
    (detail?.questions.length === 0 && Boolean(detail?.assignment.resource_file_url || detail?.assignment.description));

  const locked = isMaterial || ["submitted", "reviewed", "completed"].includes(item.status);
  const answerList =
    detail?.questions.map(
      (question) =>
        answers[question.id || ""] || {
          question_id: question.id || "",
          answer_text: null,
          selected_option_id: null,
        }
    ) || [];

  async function uploadPendingFiles() {
    for (const file of files) {
      const uploaded = await uploadHomeworkAttachment({
        file,
        studentHomeworkId: item.id,
        studentId: userId,
        kind: "submission",
      });
      if (uploaded.error) throw new Error(uploaded.error);
    }
    setFiles([]);
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await uploadPendingFiles();
      const result = await saveHomeworkDraft(item.id, answerList);
      if (result.error) throw new Error(result.error);
      setMessage(isTr ? "Taslak ve dosyalar kaydedildi." : "Draft and files saved.");
      onReload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Taslak kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await uploadPendingFiles();
      const result = await submitInteractiveHomework(item.id, answerList);
      if (result.error) throw new Error(result.error);
      setConfirming(false);
      onReload();
      onClose();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Teslim başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const setAnswer = (questionId: string, patch: Partial<HomeworkAnswer>) =>
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        question_id: questionId,
        answer_text: current[questionId]?.answer_text || null,
        selected_option_id: current[questionId]?.selected_option_id || null,
        ...patch,
      },
    }));

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <header className="flex items-start justify-between border-b border-border bg-white p-5 sm:p-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {detail?.assignment.title || item.title}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span>
                {item.due_date
                  ? `Son Teslim: ${new Date(item.due_date).toLocaleString(
                      locale === "tr" ? "tr-TR" : "en-GB"
                    )}`
                  : "—"}
              </span>
              <Status value={item.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              {message || (isTr ? "Ödev yükleniyor…" : "Loading homework…")}
            </p>
          ) : (
            <>
              {/* Instructions / Content */}
              {detail.assignment.description && (
                <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 text-xs leading-relaxed text-ink/80 whitespace-pre-wrap">
                  <strong className="text-ink font-semibold block mb-1">
                    {isMaterial
                      ? isTr ? "Ders Notu / İçerik:" : "Lesson Notes / Content:"
                      : isTr ? "Ödev Yönergesi:" : "Assignment Instructions:"}
                  </strong>
                  {detail.assignment.description}
                </div>
              )}

              {/* Resource File URL or Direct Link */}
              {(detail.assignment.resource_file_url || detail.assignment.external_link) && (
                <div className="flex flex-wrap gap-2">
                  {detail.assignment.resource_file_url && (
                    <button
                      type="button"
                      onClick={() => void openHomeworkAttachment(detail.assignment.resource_file_url!)}
                      className="inline-flex items-center gap-2 rounded-xl bg-forest/10 border border-primary/20 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-forest/20 transition-colors cursor-pointer"
                    >
                      <Download className="size-4" />
                      {detail.assignment.attachment_name || (isTr ? "Kaynak Dosyasını İndir" : "Download Resource File")}
                    </button>
                  )}

                  {detail.assignment.external_link && (
                    <a
                      href={detail.assignment.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                      {isTr ? "Harici Çalışma Kaynağını Aç" : "Open External Study Resource"}
                    </a>
                  )}
                </div>
              )}

              {/* Teacher Resources Attachments */}
              {detail.attachments.filter((file) => file.attachment_kind === "resource").length >
                0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {isTr ? "Eğitmen Kaynak Dosyaları" : "Instructor Resource Files"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detail.attachments
                      .filter((file) => file.attachment_kind === "resource")
                      .map((file) => (
                        <button
                          type="button"
                          key={file.id}
                          onClick={() => void openHomeworkAttachment(file.storage_path)}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-surface-muted transition-colors cursor-pointer"
                        >
                          <Download className="size-4 text-primary" />
                          {file.file_name}
                        </button>
                      ))}
                  </div>
                </section>
              )}

              {/* Questions (Only if questions exist and not a pure material) */}
              {detail.questions.length > 0 && (
                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isTr ? "Sorular ve Yanıtlarınız" : "Questions & Answers"}
                  </h3>
                {detail.questions.map((question, index) => {
                  const id = question.id || "";
                  return (
                    <article
                      key={id}
                      className="rounded-2xl border border-border bg-white p-4 space-y-3 shadow-2xs"
                    >
                      <p className="text-xs font-semibold text-ink">
                        <span className="font-bold mr-1">{index + 1}.</span> {question.prompt}
                      </p>

                      {question.question_type === "multiple_choice" ? (
                        <div className="grid gap-2 sm:grid-cols-2 text-xs">
                          {question.options.map((option) => (
                            <label
                              key={option.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                                answers[id]?.selected_option_id === option.id
                                  ? "border-primary bg-primary/5 font-semibold text-primary"
                                  : "border-border hover:bg-surface-muted/40"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${id}`}
                                disabled={locked}
                                checked={answers[id]?.selected_option_id === option.id}
                                onChange={() =>
                                  setAnswer(id, {
                                    selected_option_id: option.id || null,
                                    answer_text: null,
                                  })
                                }
                                className="text-primary focus:ring-primary size-4"
                              />
                              <span>
                                <b>{option.option_key}.</b> {option.option_text}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : question.question_type === "short_answer" ? (
                        <input
                          disabled={locked}
                          value={answers[id]?.answer_text || ""}
                          onChange={(e) =>
                            setAnswer(id, {
                              answer_text: e.target.value,
                              selected_option_id: null,
                            })
                          }
                          placeholder={isTr ? "Kısa cevabınızı buraya yazınız..." : "Type your short answer..."}
                          className="min-h-10 w-full rounded-xl border border-input px-3 text-xs outline-hidden focus:border-primary"
                        />
                      ) : (
                        <textarea
                          disabled={locked}
                          rows={4}
                          value={answers[id]?.answer_text || ""}
                          onChange={(e) =>
                            setAnswer(id, {
                              answer_text: e.target.value,
                              selected_option_id: null,
                            })
                          }
                          placeholder={isTr ? "Detaylı cevabınızı buraya yazınız..." : "Type your response..."}
                          className="w-full rounded-xl border border-input p-3 text-xs outline-hidden focus:border-primary"
                        />
                      )}
                    </article>
                  );
                })}
              </section>
              )}

              {/* Student File Submission */}
              {!locked && (
                <section className="rounded-2xl border border-dashed border-border bg-surface-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-ink">
                        {isTr ? "Ödev Dosyası Yükle (İsteğe Bağlı)" : "Attach Files (Optional)"}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        PDF, DOCX, PPT, Görsel · Maksimum 20 MB
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-semibold hover:bg-surface-muted transition-colors shadow-2xs">
                      <FileUp className="size-4 text-primary" />
                      {isTr ? "Dosya Seç" : "Select File"}
                      <input
                        type="file"
                        multiple
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                        onChange={(e) =>
                          setFiles(
                            Array.from(e.target.files || []).filter(
                              (file) => file.size <= 20 * 1024 * 1024
                            )
                          )
                        }
                      />
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {files.map((file, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-border px-2.5 py-1 text-xs text-ink"
                        >
                          <FileText className="size-3.5 text-primary" />
                          {file.name}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Teacher Feedback when reviewed */}
              {detail.homework.teacher_feedback && (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-emerald-700" />
                    <h3 className="text-xs font-bold text-emerald-900">
                      {isTr ? "Eğitmen Değerlendirmesi & Geri Bildirimi" : "Instructor Feedback"}
                    </h3>
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-emerald-950">
                    {detail.homework.teacher_feedback}
                  </p>
                </section>
              )}
            </>
          )}

          {message && (
            <p role="status" className="text-xs font-semibold text-primary">
              {message}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-white p-4 sm:p-5">
          {isMaterial ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
            >
              {isTr ? "Kapat" : "Close"}
            </button>
          ) : !locked ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
              >
                <Save className="size-4" />
                {busy ? "…" : isTr ? "Taslağı Kaydet" : "Save Draft"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
              >
                <Send className="size-4" />
                {isTr ? "Ödevi Teslim Et" : "Submit Homework"}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="size-4 text-emerald-600" />
              {isTr ? "Ödev Teslim Edildi (Kilitli)" : "Submitted (Locked)"}
            </span>
          )}
        </footer>

        {confirming && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
              <h3 className="font-heading text-lg font-bold text-ink">
                {isTr ? "Ödevi teslim etmek istiyor musunuz?" : "Submit this homework?"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isTr
                  ? "Teslim işleminden sonra eğitmeniniz yeni bir düzenleme talep etmedikçe cevaplarınız salt-okunur duruma geçer."
                  : "Once submitted, your answers become read-only unless your instructor requests a revision."}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold hover:bg-surface-muted"
                >
                  {isTr ? "Vazgeç" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest shadow-xs"
                >
                  {busy ? "…" : isTr ? "Teslim Et" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Status({ value }: { value: string }) {
  const label: Record<string, string> = {
    assigned: "Bekliyor",
    in_progress: "Devam Ediyor",
    submitted: "Teslim Edildi",
    reviewed: "Değerlendirildi",
    overdue: "Gecikmiş",
    late: "Gecikmiş",
    completed: "Değerlendirildi",
  };

  const isSubmitted = value === "submitted";
  const isReviewed = ["reviewed", "completed"].includes(value);

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
        isReviewed
          ? "bg-emerald-100 border border-emerald-300 text-emerald-900"
          : isSubmitted
          ? "bg-amber-100 border border-amber-300 text-amber-900"
          : "bg-muted border border-border text-muted-foreground"
      }`}
    >
      {label[value] || value}
    </span>
  );
}
