import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Archive, BookOpen, CheckCircle2, ChevronDown, Copy, Edit2, Eye, Layers, Plus, Search, X } from "lucide-react";
import {
  archiveQuestionBankItem,
  getQuestionBankItems,
  saveQuestionBankItem,
  type HomeworkOption,
  type HomeworkQuestionType,
  type QuestionBankItem,
  type QuestionDifficulty,
  type QuestionLanguage,
} from "@/lib/homework";

const EXAM_PRESETS = ["SAT", "IB", "AP", "ESAT", "TMUA", "IMAT", "UCAT", "OMPT", "GRE", "GMAT", "Genel"];

const QUESTION_TYPE_LABELS: Record<HomeworkQuestionType, string> = {
  multiple_choice: "Çoktan Seçmeli",
  short_answer: "Kısa Cevap",
  long_answer: "Uzun Cevap / Essay",
};

const emptyOptions = (): HomeworkOption[] => [
  { option_key: "A", option_text: "", is_correct: true },
  { option_key: "B", option_text: "", is_correct: false },
  { option_key: "C", option_text: "", is_correct: false },
  { option_key: "D", option_text: "", is_correct: false },
];

function createDraft(questionType: HomeworkQuestionType): Partial<QuestionBankItem> {
  return {
    code: "",
    exam: "SAT",
    topic: "",
    difficulty: "medium",
    language: "tr",
    question_type: questionType,
    prompt: "",
    options: questionType === "multiple_choice" ? emptyOptions() : [],
    reference_answer: "",
    explanation: "",
  };
}

function compactId(item: QuestionBankItem) {
  return item.code || item.id.slice(0, 8).toUpperCase();
}

export function QuestionBankManager() {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<QuestionBankItem> | null>(null);
  const [viewingItem, setViewingItem] = useState<QuestionBankItem | null>(null);

  const refreshData = () => {
    setLoading(true);
    getQuestionBankItems().then((res) => {
      if (res.error) setError(res.error);
      else setItems(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    let active = true;
    getQuestionBankItems().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setItems(res.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const exams = useMemo(
    () => Array.from(new Set(items.map((item) => item.exam))).sort((a, b) => a.localeCompare(b, "tr")),
    [items]
  );
  const topics = useMemo(
    () => Array.from(new Set(items.map((item) => item.topic))).sort((a, b) => a.localeCompare(b, "tr")),
    [items]
  );
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
    return items.filter((item) => {
      const matchesQuery = !query ||
        item.id.toLowerCase().includes(query) ||
        (item.code || "").toLocaleLowerCase("tr-TR").includes(query) ||
        item.prompt.toLocaleLowerCase("tr-TR").includes(query) ||
        item.exam.toLocaleLowerCase("tr-TR").includes(query) ||
        item.topic.toLocaleLowerCase("tr-TR").includes(query);
      return matchesQuery &&
        (!selectedType || item.question_type === selectedType) &&
        (!selectedExam || item.exam === selectedExam) &&
        (!selectedTopic || item.topic === selectedTopic);
    });
  }, [items, searchQuery, selectedExam, selectedTopic, selectedType]);

  const openCreate = (type: HomeworkQuestionType) => {
    setEditingItem(createDraft(type));
    setCreateMenuOpen(false);
    setEditorOpen(true);
  };

  const openEdit = (item: QuestionBankItem) => {
    setEditingItem({
      ...item,
      options: item.question_type === "multiple_choice" && item.options.length === 4 ? item.options : emptyOptions(),
    });
    setEditorOpen(true);
  };

  const duplicate = async (item: QuestionBankItem) => {
    const result = await saveQuestionBankItem({
      ...item,
      id: undefined,
      code: item.code ? `${item.code}-COPY` : null,
      status: "active",
    });
    if (result.error) setError(result.error);
    else {
      setMessage("Soru çoğaltıldı. Yeni kayıt bağımsız olarak düzenlenebilir.");
      refreshData();
    }
  };

  const archive = async (id: string) => {
    if (!window.confirm("Bu soruyu arşivlemek istediğinize emin misiniz?")) return;
    const result = await archiveQuestionBankItem(id);
    if (result.error) setError(result.error);
    else {
      setMessage("Soru arşivlendi.");
      refreshData();
    }
  };

  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!createMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [createMenuOpen]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-ink">Soru Kütüphanesi</h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{filteredItems.length} soru</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Ödev ve materyallerde tekrar kullanılabilen canonical soru kayıtlarını yönetin.</p>
        </div>

        <div ref={createMenuRef} className="relative self-start sm:self-auto">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
            onClick={() => setCreateMenuOpen((open) => !open)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-forest cursor-pointer"
          >
            <Plus className="size-4" /> Yeni Soru <ChevronDown className="size-3.5" />
          </button>
          {createMenuOpen && (
            <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-border bg-white p-1.5 shadow-xl">
              {(Object.keys(QUESTION_TYPE_LABELS) as HomeworkQuestionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreate(type);
                  }}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
                >
                  {QUESTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {message && <Notice tone="success" onClose={() => setMessage("")}>{message}</Notice>}
      {error && <Notice tone="error" onClose={() => setError("")}>{error}</Notice>}

      <section aria-label="Soru kütüphanesi filtreleri" className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Soru ara</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" placeholder="Soru metni, konu veya ID" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="min-h-10 w-full min-w-0 rounded-xl border border-input bg-white pl-9 pr-3 text-xs text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <FilterSelect label="Soru Tipi" value={selectedType} onChange={setSelectedType}>
          <option value="">Tüm soru tipleri</option>
          {(Object.keys(QUESTION_TYPE_LABELS) as HomeworkQuestionType[]).map((type) => <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}
        </FilterSelect>
        <FilterSelect label="Sınav" value={selectedExam} onChange={setSelectedExam}>
          <option value="">Tüm sınavlar</option>
          {exams.map((exam) => <option key={exam} value={exam}>{exam}</option>)}
        </FilterSelect>
        <FilterSelect label="Konu" value={selectedTopic} onChange={setSelectedTopic}>
          <option value="">Tüm konular</option>
          {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
        </FilterSelect>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-border bg-white p-12 text-center text-xs text-muted-foreground">Soru kütüphanesi yükleniyor…</div>
      ) : filteredItems.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-border bg-white p-12 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-ink">Bu kriterlere uyan soru bulunamadı</p>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">Filtreleri temizleyin veya “Yeni Soru” menüsünden soru tipini seçerek ilk kaydı oluşturun.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-xs">
          <table className="w-full min-w-[920px] border-collapse text-left text-xs">
            <thead className="bg-surface-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Soru özeti</th>
                <th className="px-4 py-3 font-semibold">Tip</th>
                <th className="px-4 py-3 font-semibold">Sınav</th>
                <th className="px-4 py-3 font-semibold">Konu</th>
                <th className="px-4 py-3 font-semibold">Son güncelleme</th>
                <th className="px-4 py-3 text-right font-semibold">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => (
                <tr key={item.id} className="align-top hover:bg-surface-muted/25">
                  <td className="px-4 py-3 font-mono text-[11px] font-semibold text-muted-foreground" title={item.id}>{compactId(item)}</td>
                  <td className="max-w-sm px-4 py-3 font-medium leading-5 text-ink"><span className="line-clamp-2">{item.prompt}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{QUESTION_TYPE_LABELS[item.question_type]}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{item.exam}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.topic}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(item.updated_at))}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <ActionButton label="Görüntüle" onClick={() => setViewingItem(item)}><Eye className="size-3.5" /></ActionButton>
                      <ActionButton label="Düzenle" onClick={() => openEdit(item)}><Edit2 className="size-3.5" /></ActionButton>
                      <ActionButton label="Çoğalt" onClick={() => void duplicate(item)}><Copy className="size-3.5" /></ActionButton>
                      <ActionButton label="Arşivle" danger onClick={() => void archive(item.id)}><Archive className="size-3.5" /></ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && editingItem && (
        <QuestionEditorModal
          initialItem={editingItem}
          onClose={() => { setEditorOpen(false); setEditingItem(null); }}
          onSaved={() => {
            setEditorOpen(false);
            setEditingItem(null);
            setMessage("Soru başarıyla kaydedildi.");
            refreshData();
          }}
        />
      )}
      {viewingItem && <QuestionViewModal item={viewingItem} onClose={() => setViewingItem(null)} />}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-xs text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-primary">{children}</select>
    </label>
  );
}

function ActionButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-lg border p-2 transition-colors ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-border text-muted-foreground hover:bg-surface-muted hover:text-ink"}`}>{children}</button>;
}

function Notice({ tone, onClose, children }: { tone: "success" | "error"; onClose: () => void; children: React.ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return <div className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-medium ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}><span className="flex items-center gap-2"><Icon className="size-4 shrink-0" />{children}</span><button type="button" onClick={onClose} aria-label="Bildirimi kapat"><X className="size-3.5" /></button></div>;
}

function QuestionEditorModal({ initialItem, onClose, onSaved }: { initialItem: Partial<QuestionBankItem>; onClose: () => void; onSaved: (item: QuestionBankItem) => void }) {
  const [form, setForm] = useState<Partial<QuestionBankItem>>({ ...initialItem });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setQuestionType = (type: HomeworkQuestionType) => {
    setForm((current) => ({ ...current, question_type: type, options: type === "multiple_choice" ? (current.options?.length === 4 ? current.options : emptyOptions()) : [] }));
  };
  const updateOptionText = (key: string, text: string) => setForm((current) => ({ ...current, options: (current.options || emptyOptions()).map((option) => option.option_key === key ? { ...option, option_text: text } : option) }));
  const setCorrectOption = (key: string) => setForm((current) => ({ ...current, options: (current.options || emptyOptions()).map((option) => ({ ...option, is_correct: option.option_key === key })) }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.prompt?.trim() || !form.exam?.trim() || !form.topic?.trim() || !form.question_type) {
      setError("Soru metni, sınav, konu ve soru tipi zorunludur.");
      return;
    }
    if (form.question_type === "multiple_choice") {
      const options = form.options || [];
      if (options.length !== 4 || options.some((option) => !option.option_text.trim()) || options.filter((option) => option.is_correct).length !== 1) {
        setError("A/B/C/D seçeneklerini doldurun ve tek bir doğru cevap seçin.");
        return;
      }
    }
    setBusy(true);
    setError("");
    const result = await saveQuestionBankItem(form as Parameters<typeof saveQuestionBankItem>[0]);
    setBusy(false);
    if (result.error || !result.data) setError(result.error || "Soru kaydedilemedi.");
    else onSaved(result.data);
  };

  return (
    <div className="fixed inset-0 z-[160] flex min-h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-xs sm:p-6" role="dialog" aria-modal="true" aria-labelledby="question-editor-title">
      <div className="relative my-auto flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4 sm:px-7">
          <div>
            <h3 id="question-editor-title" className="font-heading text-lg font-bold text-ink">{form.id ? "Soruyu Düzenle" : `Yeni ${QUESTION_TYPE_LABELS[form.question_type || "multiple_choice"]} Soru`}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Kayıt aynı canonical soru sistemi içinde ödev ve materyallerde yeniden kullanılabilir.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-surface-muted" aria-label="Kapat"><X className="size-4" /></button>
        </header>

        <form onSubmit={submit} className="space-y-5 overflow-y-auto p-5 sm:p-7">
          {error && <Notice tone="error" onClose={() => setError("")}>{error}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Soru Kodu (opsiyonel)"><input value={form.code || ""} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="SAT-MATH-001" className={inputClass} /></Field>
            <Field label="Soru Tipi"><select value={form.question_type || "multiple_choice"} onChange={(event) => setQuestionType(event.target.value as HomeworkQuestionType)} className={inputClass}>{(Object.keys(QUESTION_TYPE_LABELS) as HomeworkQuestionType[]).map((type) => <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}</select></Field>
            <Field label="Sınav"><input required list="question-exam-presets" value={form.exam || ""} onChange={(event) => setForm({ ...form, exam: event.target.value })} className={inputClass} /><datalist id="question-exam-presets">{EXAM_PRESETS.map((exam) => <option key={exam} value={exam} />)}</datalist></Field>
            <Field label="Konu"><input required value={form.topic || ""} onChange={(event) => setForm({ ...form, topic: event.target.value })} className={inputClass} /></Field>
            <Field label="Dil"><select value={form.language || "tr"} onChange={(event) => setForm({ ...form, language: event.target.value as QuestionLanguage })} className={inputClass}><option value="tr">Türkçe</option><option value="en">English</option></select></Field>
            <Field label="Zorluk"><select value={form.difficulty || "medium"} onChange={(event) => setForm({ ...form, difficulty: event.target.value as QuestionDifficulty })} className={inputClass}><option value="easy">Kolay</option><option value="medium">Orta</option><option value="hard">Zor</option></select></Field>
          </div>

          <Field label="Soru Metni"><textarea required rows={5} value={form.prompt || ""} onChange={(event) => setForm({ ...form, prompt: event.target.value })} className={inputClass} /></Field>

          {form.question_type === "multiple_choice" && (
            <fieldset className="space-y-3 rounded-2xl border border-border bg-surface-muted/35 p-4">
              <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">A/B/C/D Seçenekleri ve Doğru Cevap</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(form.options || emptyOptions()).map((option) => (
                  <label key={option.option_key} className={`flex min-w-0 items-center gap-2 rounded-xl border bg-white p-2.5 ${option.is_correct ? "border-emerald-400 ring-1 ring-emerald-200" : "border-border"}`}>
                    <input type="radio" name="correct-option" checked={Boolean(option.is_correct)} onChange={() => setCorrectOption(option.option_key)} />
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">{option.option_key}</span>
                    <input value={option.option_text} onChange={(event) => updateOptionText(option.option_key, event.target.value)} className="min-w-0 flex-1 rounded-sm bg-transparent text-xs text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30" placeholder={`${option.option_key} seçeneği`} />
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {form.question_type !== "multiple_choice" && (
            <Field label={form.question_type === "long_answer" ? "Referans Cevap / Rubrik (opsiyonel)" : "Kabul Edilen / Referans Cevap"}>
              <textarea rows={3} value={form.reference_answer || ""} onChange={(event) => setForm({ ...form, reference_answer: event.target.value })} className={inputClass} />
            </Field>
          )}

          <Field label={form.question_type === "long_answer" ? "Öğretmen Açıklaması (opsiyonel)" : "Açıklama / Çözüm (opsiyonel)"}>
            <textarea rows={3} value={form.explanation || ""} onChange={(event) => setForm({ ...form, explanation: event.target.value })} className={inputClass} />
          </Field>

          <footer className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-white px-5 py-4 sm:-mx-7 sm:-mb-7 sm:px-7">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-muted">Vazgeç</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50">{busy ? "Kaydediliyor…" : form.id ? "Soruyu Güncelle" : "Soru Kütüphanesine Kaydet"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function QuestionViewModal({ item, onClose }: { item: QuestionBankItem; onClose: () => void }) {
  return <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true"><article className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-white p-6 shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-border pb-4"><div><p className="font-mono text-[11px] text-muted-foreground">{item.id}</p><h3 className="mt-1 font-heading text-xl font-bold text-ink">{compactId(item)} · {QUESTION_TYPE_LABELS[item.question_type]}</h3></div><button type="button" onClick={onClose} aria-label="Kapat" className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-surface-muted"><X className="size-4" /></button></header><dl className="mt-5 grid gap-3 text-xs sm:grid-cols-3"><div><dt className="font-bold text-muted-foreground">Sınav</dt><dd className="mt-1 text-ink">{item.exam}</dd></div><div><dt className="font-bold text-muted-foreground">Konu</dt><dd className="mt-1 text-ink">{item.topic}</dd></div><div><dt className="font-bold text-muted-foreground">Son Güncelleme</dt><dd className="mt-1 text-ink">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(item.updated_at))}</dd></div></dl><div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-ink whitespace-pre-wrap">{item.prompt}</div>{item.question_type === "multiple_choice" && <div className="mt-4 grid gap-2 sm:grid-cols-2">{item.options.map((option) => <div key={option.option_key} className={`rounded-xl border p-3 text-xs ${option.is_correct ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900" : "border-border"}`}><span className="mr-2 font-bold">{option.option_key}</span>{option.option_text}</div>)}</div>}{item.reference_answer && <p className="mt-4 rounded-xl border border-border p-3 text-xs leading-5"><strong>Referans cevap / rubrik:</strong> {item.reference_answer}</p>}{item.explanation && <p className="mt-3 rounded-xl border border-border p-3 text-xs leading-5"><strong>Açıklama / çözüm:</strong> {item.explanation}</p>}</article></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

const inputClass = "min-h-10 w-full min-w-0 rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-primary";
