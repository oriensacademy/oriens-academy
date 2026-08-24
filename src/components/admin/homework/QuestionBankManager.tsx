"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit2,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  archiveQuestionBankItem,
  getQuestionBankItems,
  saveQuestionBankItem,
  type HomeworkOption,
  type HomeworkQuestionType,
  type QuestionDifficulty,
  type QuestionBankItem,
  type QuestionLanguage,
} from "@/lib/homework";

const EXAM_PRESETS = [
  "SAT",
  "AP Calculus",
  "AP Physics",
  "AP Chemistry",
  "AP Biology",
  "AP Economics",
  "IB Math",
  "IB Physics",
  "IB English",
  "IELTS",
  "TOEFL",
  "Genel",
];

const emptyOptions = (): HomeworkOption[] => [
  { option_key: "A", option_text: "", is_correct: true },
  { option_key: "B", option_text: "", is_correct: false },
  { option_key: "C", option_text: "", is_correct: false },
  { option_key: "D", option_text: "", is_correct: false },
];

export function QuestionBankManager({
  onCreateTemplateWithQuestions,
}: {
  onCreateTemplateWithQuestions?: (questions: QuestionBankItem[]) => void;
}) {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedLang, setSelectedLang] = useState("");

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<QuestionBankItem> | null>(null);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    getQuestionBankItems({
      exam: selectedExam || undefined,
      question_type: selectedType || undefined,
      language: selectedLang || undefined,
      query: searchQuery || undefined,
    }).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setItems(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selectedExam, selectedType, selectedLang, searchQuery]);

  const refreshData = () => {
    setLoading(true);
    getQuestionBankItems({
      exam: selectedExam || undefined,
      question_type: selectedType || undefined,
      language: selectedLang || undefined,
      query: searchQuery || undefined,
    }).then((res) => {
      if (res.error) setError(res.error);
      else setItems(res.data);
      setLoading(false);
    });
  };

  const handleOpenCreate = () => {
    setEditingItem({
      code: "",
      exam: "SAT",
      topic: "",
      difficulty: "medium",
      language: "en",
      question_type: "multiple_choice",
      prompt: "",
      options: emptyOptions(),
      reference_answer: "",
      explanation: "",
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (item: QuestionBankItem) => {
    setEditingItem({
      ...item,
      options:
        item.options && item.options.length === 4
          ? item.options
          : emptyOptions(),
    });
    setEditorOpen(true);
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Bu soruyu arşivlemek istediğinize emin misiniz?")) return;
    const res = await archiveQuestionBankItem(id);
    if (res.error) {
      setError(res.error);
    } else {
      setMessage("Soru arşivlendi.");
      refreshData();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-[#819586]" />
            <h2 className="text-lg font-bold text-ink">Soru Bankası</h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {items.length} Soru
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sınav, konu ve zorluk seviyelerine göre yapılandırılmış merkezi soru havuzu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && onCreateTemplateWithQuestions && (
            <button
              type="button"
              onClick={() => {
                const selected = items.filter((i) => selectedIds.includes(i.id));
                onCreateTemplateWithQuestions(selected);
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Sparkles className="size-4" />
              Seçilenlerle Şablon Oluştur ({selectedIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="size-4" />
            Yeni Soru Ekle
          </button>
        </div>
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

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Soru metni, kod veya konu ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-input bg-white pl-9 pr-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
          />
        </div>

        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
        >
          <option value="">Tüm Sınavlar</option>
          {EXAM_PRESETS.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
        >
          <option value="">Tüm Soru Tipleri</option>
          <option value="multiple_choice">Çoktan Seçmeli</option>
          <option value="short_answer">Kısa Cevap</option>
          <option value="long_answer">Uzun Cevap</option>
        </select>

        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
        >
          <option value="">Tüm Diller</option>
          <option value="en">İngilizce (EN)</option>
          <option value="tr">Türkçe (TR)</option>
        </select>
      </div>

      {/* Question Cards Grid */}
      {loading ? (
        <div className="rounded-3xl border border-border bg-white p-12 text-center text-xs text-muted-foreground">
          Soru bankası yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center space-y-3">
          <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
          <div className="text-sm font-semibold text-ink">Kayıtlı soru bulunamadı</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Arama kriterlerinizi değiştirebilir veya sağ üstteki butondan yeni bir soru oluşturabilirsiniz.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
          >
            <Plus className="size-4" /> Soru Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 transition-all shadow-xs ${
                  isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-border/80"
                }`}
              >
                <div>
                  {/* Card Header & Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                      />
                      {item.code && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {item.code}
                        </span>
                      )}
                      <span className="rounded-md bg-forest/5 border border-forest/15 px-2 py-0.5 text-[11px] font-bold text-forest">
                        {item.exam}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {item.topic}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground uppercase">
                        {item.language}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 uppercase ${
                          item.difficulty === "hard"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : item.difficulty === "easy"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {item.difficulty === "hard" ? "Zor" : item.difficulty === "easy" ? "Kolay" : "Orta"}
                      </span>
                      <span className="rounded bg-surface-muted px-2 py-0.5 text-ink">
                        {item.question_type === "multiple_choice"
                          ? "Çoktan Seçmeli"
                          : item.question_type === "short_answer"
                          ? "Kısa Cevap"
                          : "Uzun Cevap"}
                      </span>
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div className="mt-3 text-xs font-semibold leading-relaxed text-ink whitespace-pre-wrap">
                    {item.prompt}
                  </div>

                  {/* Options Preview for Multiple Choice */}
                  {item.question_type === "multiple_choice" && item.options && item.options.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {item.options.map((opt) => (
                        <div
                          key={opt.option_key}
                          className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition-colors ${
                            opt.is_correct
                              ? "border-emerald-300 bg-emerald-50/50 text-emerald-950 font-semibold"
                              : "border-border bg-surface-muted/40 text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                              opt.is_correct
                                ? "bg-emerald-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {opt.option_key}
                          </span>
                          <span className="truncate">{opt.option_text || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reference Answer for open questions */}
                  {item.question_type !== "multiple_choice" && item.reference_answer && (
                    <div className="mt-3 rounded-xl border border-dashed border-border bg-surface-muted/30 p-2.5 text-[11px] text-muted-foreground">
                      <span className="font-bold text-ink">Referans Cevap: </span>
                      <span className="whitespace-pre-wrap">{item.reference_answer}</span>
                    </div>
                  )}

                  {/* Explanation */}
                  {item.explanation && (
                    <div className="mt-2.5 text-[11px] text-muted-foreground/90 italic">
                      <span className="font-semibold text-ink not-italic">Çözüm / Açıklama: </span>
                      {item.explanation}
                    </div>
                  )}
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                  >
                    <Edit2 className="size-3.5 text-muted-foreground" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    Arşivle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Centered Question Editor Modal */}
      {editorOpen && editingItem && (
        <QuestionEditorModal
          initialItem={editingItem}
          onClose={() => {
            setEditorOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setEditorOpen(false);
            setEditingItem(null);
            setMessage("Soru başarıyla kaydedildi.");
            refreshData();
          }}
        />
      )}
    </div>
  );
}

function QuestionEditorModal({
  initialItem,
  onClose,
  onSaved,
}: {
  initialItem: Partial<QuestionBankItem>;
  onClose: () => void;
  onSaved: (item: QuestionBankItem) => void;
}) {
  const [form, setForm] = useState<Partial<QuestionBankItem>>({ ...initialItem });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.prompt?.trim()) {
      setError("Soru metni zorunludur.");
      return;
    }
    if (!form.exam?.trim() || !form.topic?.trim()) {
      setError("Sınav ve konu alanları zorunludur.");
      return;
    }

    if (form.question_type === "multiple_choice") {
      const opts = form.options || [];
      if (opts.some((o) => !o.option_text?.trim())) {
        setError("Çoktan seçmeli soru için tüm 4 seçeneği doldurunuz.");
        return;
      }
      if (!opts.some((o) => o.is_correct)) {
        setError("Lütfen en az bir doğru seçenek belirleyiniz.");
        return;
      }
    }

    setBusy(true);
    setError("");

    const res = await saveQuestionBankItem(
      form as Parameters<typeof saveQuestionBankItem>[0]
    );
    setBusy(false);

    if (res.error || !res.data) {
      setError(res.error || "Soru kaydedilemedi.");
    } else {
      onSaved(res.data);
    }
  };

  const updateOptionText = (key: string, text: string) => {
    setForm((prev) => ({
      ...prev,
      options: (prev.options || emptyOptions()).map((opt) =>
        opt.option_key === key ? { ...opt, option_text: text } : opt
      ),
    }));
  };

  const setCorrectOption = (key: string) => {
    setForm((prev) => ({
      ...prev,
      options: (prev.options || emptyOptions()).map((opt) => ({
        ...opt,
        is_correct: opt.option_key === key,
      })),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-2xl rounded-3xl border border-border bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-[#819586]" />
            <h2 className="text-base font-bold text-ink">
              {form.id ? "Soruyu Düzenle" : "Soru Bankasına Yeni Soru Ekle"}
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

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Soru Kodu (İsteğe Bağlı)
              </label>
              <input
                type="text"
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Örn: SAT-MATH-01"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Sınav Türü
              </label>
              <input
                type="text"
                list="exam-presets-list"
                value={form.exam || ""}
                onChange={(e) => setForm({ ...form, exam: e.target.value })}
                placeholder="Örn: SAT, AP Calculus"
                required
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
              <datalist id="exam-presets-list">
                {EXAM_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Konu / Başlık
              </label>
              <input
                type="text"
                value={form.topic || ""}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="Örn: Quadratic Equations"
                required
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Soru Dili
              </label>
              <select
                value={form.language || "en"}
                onChange={(e) => setForm({ ...form, language: e.target.value as QuestionLanguage })}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              >
                <option value="en">İngilizce (English)</option>
                <option value="tr">Türkçe</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Zorluk Seviyesi
              </label>
              <select
                value={form.difficulty || "medium"}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as QuestionDifficulty })}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              >
                <option value="easy">Kolay (Easy)</option>
                <option value="medium">Orta (Medium)</option>
                <option value="hard">Zor (Hard)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Soru Tipi
              </label>
              <select
                value={form.question_type || "multiple_choice"}
                onChange={(e) =>
                  setForm({ ...form, question_type: e.target.value as HomeworkQuestionType })
                }
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              >
                <option value="multiple_choice">Çoktan Seçmeli</option>
                <option value="short_answer">Kısa Cevap</option>
                <option value="long_answer">Uzun Cevap / Essay</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Soru Metni & Yönergesi
            </label>
            <textarea
              rows={4}
              value={form.prompt || ""}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Soruyu buraya yazınız..."
              required
              className="w-full rounded-xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
            />
          </div>

          {/* Multiple Choice Options */}
          {form.question_type === "multiple_choice" && (
            <div className="space-y-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase">
                Seçenekler ve Doğru Cevap (Doğru seçeneği işaretleyin)
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {(form.options || emptyOptions()).map((opt) => (
                  <div
                    key={opt.option_key}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors bg-white ${
                      opt.is_correct ? "border-emerald-400 ring-1 ring-emerald-300" : "border-border"
                    }`}
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="correct-option-radio"
                        checked={opt.is_correct}
                        onChange={() => setCorrectOption(opt.option_key)}
                        className="text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
                      />
                      <span
                        className={`flex size-6 items-center justify-center rounded-lg text-xs font-bold ${
                          opt.is_correct
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {opt.option_key}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={opt.option_text}
                      onChange={(e) => updateOptionText(opt.option_key, e.target.value)}
                      placeholder={`${opt.option_key} seçeneğinin içeriği...`}
                      className="flex-1 rounded-lg border border-input px-3 py-1.5 text-xs text-ink outline-hidden focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Short & Long Answer Reference */}
          {form.question_type !== "multiple_choice" && (
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Eğitmen Referans Cevabı (Yalnızca Yönetici Görür)
              </label>
              <textarea
                rows={2}
                value={form.reference_answer || ""}
                onChange={(e) => setForm({ ...form, reference_answer: e.target.value })}
                placeholder="Beklenen referans cevabı buraya yazabilirsiniz..."
                className="w-full rounded-xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Çözüm Adımları & Açıklama (İsteğe Bağlı)
            </label>
            <textarea
              rows={2}
              value={form.explanation || ""}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              placeholder="Öğrenciye değerlendirme sonrası gösterilebilecek detaylı çözüm açıklaması..."
              className="w-full rounded-xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
            />
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
              {busy ? "Kaydediliyor..." : form.id ? "Güncelle" : "Soru Bankasına Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
