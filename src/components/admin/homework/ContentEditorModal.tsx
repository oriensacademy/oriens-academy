"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  FileText,
  FileUp,
  GraduationCap,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  getQuestionBankItems,
  saveHomeworkTemplate,
  uploadHomeworkAttachment,
  type HomeworkContentType,
  type HomeworkOption,
  type HomeworkQuestion,
  type HomeworkQuestionType,
  type HomeworkTemplate,
  type QuestionBankItem,
  type QuestionLanguage,
} from "@/lib/homework";

interface ContentEditorModalProps {
  isOpen: boolean;
  initialTemplate?: HomeworkTemplate | null;
  onClose: () => void;
  onSaved: (template: HomeworkTemplate) => void;
}

const SUPPORTED_EXAM_OPTIONS = [
  { value: "", label: "Genel / Sınavsız" },
  { value: "ib", label: "IB (International Baccalaureate)" },
  { value: "ap", label: "AP (Advanced Placement)" },
  { value: "sat", label: "Digital SAT" },
  { value: "act", label: "ACT" },
  { value: "ielts", label: "IELTS" },
  { value: "toefl", label: "TOEFL" },
  { value: "matura", label: "Matura" },
  { value: "abitur", label: "Abitur" },
  { value: "other", label: "Diğer" },
];

export function ContentEditorModal({
  isOpen,
  initialTemplate,
  onClose,
  onSaved,
}: ContentEditorModalProps) {
  // Scroll lock & Escape key
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-ink/55 backdrop-blur-xs transition-opacity cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[min(900px,94vh)] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <header className="shrink-0 border-b border-border bg-surface px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-forest/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-ink">
                  {initialTemplate ? "İçeriği Düzenle" : "Yeni İçerik & Materyal Oluştur"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ödev, ders notu, kaynak doküman veya deneme sınavı hazırlayın.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <ContentEditorForm
          key={initialTemplate?.id || "new-template"}
          initialTemplate={initialTemplate}
          onClose={onClose}
          onSaved={onSaved}
        />
      </div>
    </div>,
    document.body
  );
}

function ContentEditorForm({
  initialTemplate,
  onClose,
  onSaved,
}: {
  initialTemplate?: HomeworkTemplate | null;
  onClose: () => void;
  onSaved: (template: HomeworkTemplate) => void;
}) {
  const [contentType, setContentType] = useState<HomeworkContentType>(
    () => initialTemplate?.content_type || "homework"
  );
  const [title, setTitle] = useState(() => initialTemplate?.title || "");
  const [description, setDescription] = useState(() => initialTemplate?.description || "");
  const [subject, setSubject] = useState(() => initialTemplate?.subject || "");
  const [exam, setExam] = useState(
    () => initialTemplate?.exam || initialTemplate?.exam_code || ""
  );
  const [language, setLanguage] = useState<QuestionLanguage>(
    () => initialTemplate?.language || "tr"
  );
  const [duration, setDuration] = useState<string>(() =>
    initialTemplate?.estimated_duration_minutes
      ? String(initialTemplate.estimated_duration_minutes)
      : ""
  );
  const [externalLink, setExternalLink] = useState(() => initialTemplate?.external_link || "");
  const [instructorNote, setInstructorNote] = useState(
    () => initialTemplate?.instructor_note || ""
  );
  const [resourceFileUrl, setResourceFileUrl] = useState(
    () => initialTemplate?.resource_file_url || ""
  );
  const [attachmentName, setAttachmentName] = useState(
    () => initialTemplate?.attachment_name || ""
  );

  // Questions State
  const [questions, setQuestions] = useState<HomeworkQuestion[]>(
    () => initialTemplate?.questions || []
  );

  // Uploading and Saving state
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Question Pool Modal State
  const [poolModalOpen, setPoolModalOpen] = useState(false);
  const [poolItems, setPoolItems] = useState<QuestionBankItem[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [newQuestionMenuOpen, setNewQuestionMenuOpen] = useState(false);
  const newQuestionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newQuestionMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!newQuestionMenuRef.current?.contains(event.target as Node)) {
        setNewQuestionMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [newQuestionMenuOpen]);

  // Load question pool
  const openQuestionPool = async () => {
    setPoolModalOpen(true);
    setPoolLoading(true);
    const res = await getQuestionBankItems({ exam: exam || undefined });
    setPoolItems(res.data || []);
    setPoolLoading(false);
  };

  const handleAddQuestionFromPool = (item: QuestionBankItem) => {
    const newQ: HomeworkQuestion = {
      question_bank_id: item.id,
      position: questions.length,
      question_type: item.question_type,
      prompt: item.prompt,
      reference_answer: item.reference_answer,
      explanation: item.explanation,
      options: item.options || [],
    };
    setQuestions([...questions, newQ]);
    setPoolModalOpen(false);
  };

  // Add Blank Question
  const handleAddBlankQuestion = (type: HomeworkQuestionType) => {
    const blankOptions: HomeworkOption[] =
      type === "multiple_choice"
        ? [
            { option_key: "A", option_text: "", is_correct: true },
            { option_key: "B", option_text: "", is_correct: false },
            { option_key: "C", option_text: "", is_correct: false },
            { option_key: "D", option_text: "", is_correct: false },
          ]
        : [];

    const newQ: HomeworkQuestion = {
      position: questions.length,
      question_type: type,
      prompt: "",
      options: blankOptions,
      reference_answer: "",
      explanation: "",
    };
    setQuestions([...questions, newQ]);
    setNewQuestionMenuOpen(false);
  };

  // Update Question Field
  const updateQuestion = (idx: number, patch: Partial<HomeworkQuestion>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...patch };
    setQuestions(updated);
  };

  // Remove Question
  const removeQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, position: i }));
    setQuestions(updated);
  };

  // Upload Resource Attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    const res = await uploadHomeworkAttachment({ file, kind: "resource" });
    setUploading(false);
    if (res.error || !res.storagePath) {
      setError(res.error || "Dosya yüklenemedi.");
      return;
    }

    setResourceFileUrl(res.storagePath);
    setAttachmentName(file.name);
  };

  // Save Content
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Lütfen içerik başlığını girin.");
      return;
    }

    setSaving(true);
    setError("");

    const res = await saveHomeworkTemplate({
      id: initialTemplate?.id,
      title: title.trim(),
      description: description.trim(),
      content_type: contentType,
      language,
      subject: subject.trim() || null,
      exam: exam.trim() || null,
      exam_code: exam.trim() || null,
      estimated_duration_minutes: duration ? parseInt(duration, 10) : null,
      external_link: externalLink.trim() || null,
      instructor_note: instructorNote.trim() || null,
      resource_file_url: resourceFileUrl || null,
      attachment_name: attachmentName || null,
      questions: isSubmittable(contentType) ? questions : [],
    });

    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error || "İçerik kaydedilemedi.");
      return;
    }

    onSaved(res.data);
  };

  const isSubmittable = (type: HomeworkContentType) =>
    type === "homework" || type === "worksheet" || type === "mock_exam";

  const typeEntries: Array<{
    type: HomeworkContentType;
    label: string;
    description: string;
    icon: typeof BookOpen;
  }> = [
    {
      type: "homework",
      label: "Ödev",
      description: "Öğrencinin teslim edeceği ve geri bildirim alacağı çalışma.",
      icon: FileText,
    },
    {
      type: "lesson_note",
      label: "Ders Notu",
      description: "Ders özeti, konu anlatımı ve kaynak notları (Teslim gerektirmez).",
      icon: BookOpen,
    },
    {
      type: "worksheet",
      label: "Çalışma Kağıdı",
      description: "Ders içi veya pratik sorular içeren interaktif çalışma.",
      icon: Layers,
    },
    {
      type: "resource",
      label: "Kaynak / Materyal",
      description: "PDF, doküman, sunum veya faydalı linkler (Teslim gerektirmez).",
      icon: FileUp,
    },
    {
      type: "mock_exam",
      label: "Deneme",
      description: "Süre kısıtlı ve puanlanabilir deneme sınav seti.",
      icon: GraduationCap,
    },
  ];

  return (
    <>
      <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Content Type Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            İçerik Türü Seçin
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {typeEntries.map((item) => {
              const Icon = item.icon;
              const isSelected = contentType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setContentType(item.type)}
                  className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary"
                      : "border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="size-4 shrink-0" />
                    <span className="font-bold text-xs">{item.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Basic Information */}
        <div className="rounded-2xl border border-border bg-surface/50 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink mb-1">
                Başlık <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="örn. IB Math HL — Calculus & Limits Özeti"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">İçerik Dili</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as QuestionLanguage)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Exam */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">İlgili Sınav / Program</label>
              <select
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {SUPPORTED_EXAM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject / Topic */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Ders / Konu</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="örn. Matematik, Fizik, Essay Writing"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            {/* Duration (For Submittable / Mock Exam) */}
            {isSubmittable(contentType) && (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Tahmini Süre / Zaman Kısıtı (Dk)
                </label>
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="örn. 45"
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
            )}
          </div>

          {/* Description / Markdown Notes */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Açıklama / Ders Notu İçeriği
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Öğrencinin göreceği yönergeler veya doğrudan ders notu metni..."
              className="w-full rounded-xl border border-border bg-white p-3 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {/* STEP 3: Resource Attachments & External Links */}
        <div className="rounded-2xl border border-border bg-surface/50 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Materyal Dosyası & Harici Bağlantı
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* File Upload */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Kaynak Dosyası (PDF, DOCX, Resim vb.)
              </label>
              <div className="flex items-center gap-2">
                <label className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors">
                  {uploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Yükleniyor...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="size-3.5 text-primary" />
                      <span>Dosya Seç</span>
                    </>
                  )}
                  <input
                    type="file"
                    disabled={uploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {attachmentName && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={attachmentName}>
                    {attachmentName}
                  </span>
                )}
                {resourceFileUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setResourceFileUrl("");
                      setAttachmentName("");
                    }}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Kaldır
                  </button>
                )}
              </div>
            </div>

            {/* External Link */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Harici Bağlantı (Google Drive, GeoGebra, Zoom vb.)
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="url"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-border bg-white pl-9 pr-3.5 py-2 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* STEP 4: Question Builder (For Homework, Worksheets, Mock Exams) */}
        {isSubmittable(contentType) && (
          <div className="rounded-2xl border border-border bg-surface/50 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sorular ({questions.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  İnteraktif sorular ekleyebilir veya soru havuzundan kayıtlı soru seçebilirsiniz.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openQuestionPool}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"
                >
                  <Layers className="size-3.5" />
                  Kayıtlı Sorudan Seç
                </button>

                <div ref={newQuestionMenuRef} className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={newQuestionMenuOpen}
                    onClick={() => setNewQuestionMenuOpen((open) => !open)}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-ink px-3 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors"
                  >
                    <Plus className="size-3.5" />
                    Yeni Soru Ekle
                    <ChevronDown className="size-3" />
                  </button>
                  {newQuestionMenuOpen && <div role="menu" className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col rounded-xl border border-border bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleAddBlankQuestion("multiple_choice")}
                      className="rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-ink hover:bg-surface-muted"
                    >
                      Çoktan Seçmeli
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlankQuestion("short_answer")}
                      className="rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-ink hover:bg-surface-muted"
                    >
                      Kısa Cevap
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlankQuestion("long_answer")}
                      className="rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-ink hover:bg-surface-muted"
                    >
                      Uzun Cevap / Essay
                    </button>
                  </div>}
                </div>
              </div>
            </div>

            {/* Questions List */}
            {questions.length > 0 ? (
              <div className="space-y-4">
                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-2xl border border-border bg-white p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-forest/10 text-xs font-bold text-primary">
                          {qIdx + 1}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                          {q.question_type === "multiple_choice"
                            ? "Çoktan Seçmeli"
                            : q.question_type === "short_answer"
                            ? "Kısa Cevap"
                            : "Uzun Cevap"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIdx)}
                        className="text-muted-foreground hover:text-red-600 p-1 cursor-pointer"
                        title="Soruyu Sil"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* Prompt */}
                    <div>
                      <label className="block text-[11px] font-semibold text-ink mb-1">
                        Soru Metni <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={q.prompt}
                        onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                        placeholder="Soru yönergesi veya soruyu buraya yazın..."
                        className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                    </div>

                    {/* Options for Multiple Choice */}
                    {q.question_type === "multiple_choice" && (
                      <div className="space-y-2 pt-1">
                        <label className="block text-[11px] font-semibold text-ink">
                          Seçenekler (Doğru seçeneği işaretleyin)
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(q.options || []).map((opt, optIdx) => (
                            <div
                              key={opt.option_key}
                              className={`flex items-center gap-2 rounded-xl border p-2 ${
                                opt.is_correct
                                  ? "border-emerald-300 bg-emerald-50/50"
                                  : "border-border bg-surface"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-opt-${qIdx}`}
                                checked={Boolean(opt.is_correct)}
                                onChange={() => {
                                  const updatedOpts = (q.options || []).map((o, idx) => ({
                                    ...o,
                                    is_correct: idx === optIdx,
                                  }));
                                  updateQuestion(qIdx, { options: updatedOpts });
                                }}
                                className="size-3.5 accent-forest cursor-pointer"
                              />
                              <span className="font-bold text-xs text-ink w-4">{opt.option_key}:</span>
                              <input
                                type="text"
                                value={opt.option_text}
                                onChange={(e) => {
                                  const updatedOpts = [...(q.options || [])];
                                  updatedOpts[optIdx] = { ...updatedOpts[optIdx], option_text: e.target.value };
                                  updateQuestion(qIdx, { options: updatedOpts });
                                }}
                                placeholder={`Seçenek ${opt.option_key}`}
                                className="w-full rounded-sm bg-transparent text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reference Answer & Explanation */}
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                          Referans / İdeal Cevap (Opsiyonel)
                        </label>
                        <input
                          type="text"
                          value={q.reference_answer || ""}
                          onChange={(e) => updateQuestion(qIdx, { reference_answer: e.target.value })}
                          placeholder="Değerlendirme için referans cevap"
                          className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                          Çözüm / Açıklama (Opsiyonel)
                        </label>
                        <input
                          type="text"
                          value={q.explanation || ""}
                          onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })}
                          placeholder="Öğrencinin göreceği çözüm açıklaması"
                          className="w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-surface-muted/30">
                Henüz soru eklenmedi. Yukarıdaki butonlarla soru ekleyebilir veya soru havuzundan seçebilirsiniz.
              </div>
            )}
          </div>
        )}

        {/* Footer Submit */}
        <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-white px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-ink px-5 text-xs font-semibold text-white hover:bg-forest cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Kaydediliyor...</span>
              </>
            ) : (
              <span>{initialTemplate ? "Değişiklikleri Kaydet" : "İçeriği Oluştur"}</span>
            )}
          </button>
        </div>
      </form>

      {/* QUESTION BANK PICKER MODAL */}
      {poolModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs"
          role="dialog"
        >
          <div className="relative flex h-[min(700px,85vh)] w-[min(800px,94vw)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface">
              <h3 className="font-heading text-base font-bold text-ink">Soru Havuzundan Seç</h3>
              <button
                type="button"
                onClick={() => setPoolModalOpen(false)}
                className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-4 border-b border-border">
              <input
                type="text"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Konu, sınav veya soru metni ile ara..."
                className="w-full rounded-xl border border-border px-3.5 py-2 text-xs focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {poolLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : poolItems.length > 0 ? (
                poolItems
                  .filter(
                    (item) =>
                      !poolSearch ||
                      item.id.toLowerCase().includes(poolSearch.toLowerCase()) ||
                      (item.code || "").toLowerCase().includes(poolSearch.toLowerCase()) ||
                      item.prompt.toLowerCase().includes(poolSearch.toLowerCase()) ||
                      item.exam.toLowerCase().includes(poolSearch.toLowerCase()) ||
                      item.topic.toLowerCase().includes(poolSearch.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3.5 hover:border-primary/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {item.exam.toUpperCase()} · {item.topic}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {item.question_type}
                          </span>
                        </div>
                        <p className="text-xs text-ink line-clamp-2">{item.prompt}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddQuestionFromPool(item)}
                        className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest cursor-pointer"
                      >
                        Seç ve Ekle
                      </button>
                    </div>
                  ))
              ) : (
                <div className="text-center py-12 text-xs text-muted-foreground">
                  Kayıtlı soru bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
