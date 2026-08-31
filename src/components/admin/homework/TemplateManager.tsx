"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookCopy,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit,
  ExternalLink,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  archiveHomeworkTemplate,
  duplicateHomeworkTemplate,
  getHomeworkTemplates,
  getQuestionBankItems,
  saveHomeworkTemplate,
  type HomeworkQuestion,
  type HomeworkTemplate,
  type QuestionBankItem,
} from "@/lib/homework";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";

export function TemplateManager({
  initialPreloadedQuestions,
  onAssignTemplate,
}: {
  initialPreloadedQuestions?: QuestionBankItem[] | null;
  onAssignTemplate?: (template: HomeworkTemplate) => void;
}) {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [templates, setTemplates] = useState<HomeworkTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Editor Modal State initialized with preloaded questions if provided
  const [editorOpen, setEditorOpen] = useState(() =>
    Boolean(initialPreloadedQuestions && initialPreloadedQuestions.length > 0)
  );
  const [editingTemplate, setEditingTemplate] = useState<Partial<HomeworkTemplate> | null>(() => {
    if (!initialPreloadedQuestions || initialPreloadedQuestions.length === 0) return null;
    const qList = initialPreloadedQuestions.map((q, idx) => ({
      position: idx,
      question_type: q.question_type,
      prompt: q.prompt,
      reference_answer: q.reference_answer,
      explanation: q.explanation,
      options: q.options || [],
    }));
    return {
      title: `${initialPreloadedQuestions[0]?.exam || "Özel"} Ödev Seti`,
      description: "Soru bankasından derlenen çalışma seti.",
      subject: initialPreloadedQuestions[0]?.topic || "",
      exam: initialPreloadedQuestions[0]?.exam || "",
      estimated_duration_minutes: 45,
      questions: qList,
    };
  });

  useEffect(() => {
    let active = true;
    getHomeworkTemplates().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setTemplates(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const refreshData = () => {
    setLoading(true);
    getHomeworkTemplates().then((res) => {
      if (res.error) setError(res.error);
      else setTemplates(res.data);
      setLoading(false);
    });
  };

  const handleOpenCreate = () => {
    setEditingTemplate({
      title: "",
      description: "",
      subject: "",
      exam: "SAT",
      estimated_duration_minutes: 30,
      external_link: "",
      instructor_note: "",
      questions: [],
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (t: HomeworkTemplate) => {
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    const res = await duplicateHomeworkTemplate(id);
    if (res.error) setError(res.error);
    else {
      setMessage("Şablon başarıyla kopyalandı.");
      refreshData();
    }
  };

  const handleArchive = (id: string) => {
    requestConfirmation({ title: "Ödev şablonunu arşivle", description: "Bu şablon aktif listeden kaldırılacak ve arşivde korunacaktır.", confirmLabel: "Arşivle", action: async () => {
      const res = await archiveHomeworkTemplate(id);
      if (res.error) setError(res.error); else { setMessage("Şablon arşivlendi."); refreshData(); }
    }});
  };

  const filtered = templates.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.exam && t.exam.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      {confirmationDialog}
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <BookCopy className="size-5 text-[#819586]" />
            <h2 className="text-lg font-bold text-ink">Ödev Şablonları</h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {templates.length} Şablon
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tekrar kullanılabilir, soru snapshot&apos;ı korunan merkezi ödev taslakları.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="size-4" />
          Ödev Şablonu Oluştur
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage("")} className="text-emerald-800 hover:text-emerald-950">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-700" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-800 hover:text-red-950">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Şablon başlığı, konu veya sınav ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-input bg-white pl-10 pr-4 py-2.5 text-xs text-ink outline-hidden focus:border-primary shadow-xs"
        />
      </div>

      {/* Template Cards */}
      {loading ? (
        <div className="rounded-3xl border border-border bg-white p-12 text-center text-xs text-muted-foreground">
          Şablonlar yükleniyor...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center space-y-3">
          <BookCopy className="mx-auto size-8 text-muted-foreground/50" />
          <div className="text-sm font-semibold text-ink">Henüz kayıtlı şablon bulunamadı</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Öğrencilere hızla ödev atamak için soru bankasından veya sıfırdan şablon oluşturabilirsiniz.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
          >
            <Plus className="size-4" /> Şablon Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-xs transition-all hover:border-border/80"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    {t.exam && (
                      <span className="rounded-md bg-forest/5 border border-forest/15 px-2 py-0.5 text-[11px] font-bold text-forest">
                        {t.exam}
                      </span>
                    )}
                    {t.subject && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {t.subject}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                    {t.estimated_duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground" />
                        {t.estimated_duration_minutes} dk
                      </span>
                    )}
                    <span className="rounded bg-surface-muted px-2 py-0.5 text-ink font-semibold">
                      {t.questions?.length || 0} Soru
                    </span>
                  </div>
                </div>

                <h3 className="mt-3 text-sm font-bold text-ink">{t.title}</h3>
                {t.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                )}

                {t.external_link && (
                  <a
                    href={t.external_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Harici Kaynak Bağlantısı
                  </a>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => onAssignTemplate?.(t)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-forest/90 transition-colors cursor-pointer shadow-xs"
                >
                  <CalendarPlus className="size-3.5" />
                  Öğrenciye Ata
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(t.id)}
                    title="Kopyala"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                  >
                    <Copy className="size-3.5 text-muted-foreground" />
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(t)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                  >
                    <Edit className="size-3.5 text-muted-foreground" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(t.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Large Centered Template Editor Modal */}
      {editorOpen && editingTemplate && (
        <TemplateEditorModal
          initialTemplate={editingTemplate}
          onClose={() => {
            setEditorOpen(false);
            setEditingTemplate(null);
          }}
          onSaved={() => {
            setEditorOpen(false);
            setEditingTemplate(null);
            setMessage("Şablon kaydedildi.");
            refreshData();
          }}
        />
      )}
    </div>
  );
}

function TemplateEditorModal({
  initialTemplate,
  onClose,
  onSaved,
}: {
  initialTemplate: Partial<HomeworkTemplate>;
  onClose: () => void;
  onSaved: (template: HomeworkTemplate) => void;
}) {
  const [form, setForm] = useState<Partial<HomeworkTemplate>>({ ...initialTemplate });
  const [questions, setQuestions] = useState<HomeworkQuestion[]>(initialTemplate.questions || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Question Bank Picker Sub-Modal State
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) {
      setError("Şablon başlığı zorunludur.");
      return;
    }
    if (questions.length === 0) {
      setError("Lütfen şablona en az 1 soru ekleyiniz.");
      return;
    }

    setBusy(true);
    setError("");

    const res = await saveHomeworkTemplate({
      id: form.id,
      title: form.title,
      description: form.description || "",
      subject: form.subject || null,
      exam: form.exam || null,
      estimated_duration_minutes: form.estimated_duration_minutes || null,
      external_link: form.external_link || null,
      instructor_note: form.instructor_note || null,
      questions,
    });

    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error || "Şablon kaydedilemedi.");
    } else {
      onSaved(res.data);
    }
  };

  const moveQuestion = (idx: number, delta: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((q, p) => ({ ...q, position: p }));
    });
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) =>
      prev.filter((_, i) => i !== idx).map((q, p) => ({ ...q, position: p }))
    );
  };

  const handleAddFromBank = (selected: QuestionBankItem[]) => {
    const converted: HomeworkQuestion[] = selected.map((q, idx) => ({
      position: questions.length + idx,
      question_type: q.question_type,
      prompt: q.prompt,
      reference_answer: q.reference_answer,
      explanation: q.explanation,
      options: q.options || [],
    }));
    setQuestions((prev) => [...prev, ...converted]);
    setPickerOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-4xl rounded-3xl border border-border bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BookCopy className="size-5 text-[#819586]" />
            <h2 className="text-base font-bold text-ink">
              {form.id ? "Ödev Şablonunu Düzenle" : "Yeni Ödev Şablonu Oluştur"}
            </h2>
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

        <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Şablon Başlığı
              </label>
              <input
                type="text"
                required
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Örn: SAT Math — Quadratics & Circles (Set 1)"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Sınav Kategori
              </label>
              <input
                type="text"
                value={form.exam || ""}
                onChange={(e) => setForm({ ...form, exam: e.target.value })}
                placeholder="Örn: SAT, AP, IB"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Konu / Ders Alanı
              </label>
              <input
                type="text"
                value={form.subject || ""}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Örn: Cebir & Fonksiyonlar"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Tahmini Süre (Dakika)
              </label>
              <input
                type="number"
                min={5}
                value={form.estimated_duration_minutes || ""}
                onChange={(e) =>
                  setForm({ ...form, estimated_duration_minutes: Number(e.target.value) || null })
                }
                placeholder="Örn: 45"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Harici Link (Drive, Docs vb.)
              </label>
              <input
                type="url"
                value={form.external_link || ""}
                onChange={(e) => setForm({ ...form, external_link: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Ödev Yönergesi / Açıklama
            </label>
            <textarea
              rows={2}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Öğrencinin bu ödevi tamamlarken izleyeceği adımlar..."
              className="w-full rounded-xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
            />
          </div>

          {/* Question List Section */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-ink uppercase">
                  Şablon Soruları ({questions.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Soru bankasından hazır soru ekleyin veya sırasını düzenleyin.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer"
                >
                  <Layers className="size-3.5" />
                  Soru Bankasından Seç
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-xs text-muted-foreground">
                Bu şablonda henüz soru yok. Lütfen yukarıdaki butona tıklayarak soru bankasından soru ekleyin.
              </div>
            ) : (
              <div className="space-y-2.5">
                {questions.map((q, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-ink">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                            {q.question_type === "multiple_choice"
                              ? "Çoktan Seçmeli"
                              : q.question_type === "short_answer"
                              ? "Kısa Cevap"
                              : "Uzun Cevap"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-ink line-clamp-2">
                          {q.prompt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveQuestion(index, -1)}
                        className="rounded p-1 hover:bg-surface-muted disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === questions.length - 1}
                        onClick={() => moveQuestion(index, 1)}
                        className="rounded p-1 hover:bg-surface-muted disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="rounded p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy ? "Kaydediliyor..." : form.id ? "Şablonu Güncelle" : "Şablonu Kaydet"}
            </button>
          </div>
        </form>
      </div>

      {/* Question Bank Picker Modal */}
      {pickerOpen && (
        <QuestionBankPickerModal
          onClose={() => setPickerOpen(false)}
          onAdd={handleAddFromBank}
        />
      )}
    </div>
  );
}

function QuestionBankPickerModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (questions: QuestionBankItem[]) => void;
}) {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestionBankItems({ exam: examFilter || undefined, query: search || undefined }).then(
      (res) => {
        setItems(res.data);
        setLoading(false);
      }
    );
  }, [search, examFilter]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[160] min-h-[100dvh] w-screen flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-3xl rounded-3xl border border-border bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-ink">Soru Bankasından Soru Seç</h3>
            <p className="text-xs text-muted-foreground">
              Şablona dahil etmek istediğiniz soruları işaretleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Soru metni veya konu ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
          />
          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
          >
            <option value="">Tüm Sınavlar</option>
            <option value="SAT">SAT</option>
            <option value="AP Calculus">AP Calculus</option>
            <option value="AP Physics">AP Physics</option>
            <option value="IB Math">IB Math</option>
            <option value="IELTS">IELTS</option>
          </select>
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Yükleniyor...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Soru bulunamadı.</div>
          ) : (
            items.map((item) => {
              const isChecked = selectedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    isChecked
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-white hover:bg-surface-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-forest/5 border border-forest/15 px-1.5 py-0.5 text-[10px] font-bold text-forest">
                        {item.exam}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {item.topic}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        ({item.language})
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-ink line-clamp-2">
                      {item.prompt}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {selectedIds.length} soru seçildi
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => {
                const selected = items.filter((i) => selectedIds.includes(i.id));
                onAdd(selected);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50"
            >
              <Check className="size-4" />
              Seçilenleri Ekle ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
