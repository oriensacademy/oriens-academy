"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Check,
  CheckCircle2,
  Edit,
  GraduationCap,
  Layers,
  Plus,
  Search,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  archiveMockExam,
  getMockExams,
  getQuestionBankItems,
  saveMockExam,
  type HomeworkQuestion,
  type MockExam,
  type QuestionBankItem,
} from "@/lib/homework";

export function MockExamManager({
  onAssignMockExam,
}: {
  onAssignMockExam?: (mock: MockExam) => void;
}) {
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMock, setEditingMock] = useState<Partial<MockExam> | null>(null);

  useEffect(() => {
    let active = true;
    getMockExams().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setMocks(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const refreshData = () => {
    setLoading(true);
    getMockExams().then((res) => {
      if (res.error) setError(res.error);
      else setMocks(res.data);
      setLoading(false);
    });
  };

  const handleOpenCreate = () => {
    setEditingMock({
      title: "",
      exam: "SAT",
      description: "",
      time_limit_minutes: 65,
      topic_mix: "Math & Reading",
      questions: [],
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (m: MockExam) => {
    setEditingMock(m);
    setEditorOpen(true);
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Bu denemeyi arşivlemek istediğinize emin misiniz?")) return;
    const res = await archiveMockExam(id);
    if (res.error) setError(res.error);
    else {
      setMessage("Deneme arşivlendi.");
      refreshData();
    }
  };

  const filtered = mocks.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.exam.toLowerCase().includes(q) ||
      (m.topic_mix && m.topic_mix.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-[#819586]" />
            <h2 className="text-lg font-bold text-ink">Denemeler (Mock Exams)</h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {mocks.length} Deneme Seti
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Süre sınırlı, çok konulu ve sınav simülasyonu sağlayan deneme sınavı havuzu.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="size-4" />
          Yeni Deneme Oluştur
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
          placeholder="Deneme başlığı, sınav veya konu dağılımı ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-input bg-white pl-10 pr-4 py-2.5 text-xs text-ink outline-hidden focus:border-primary shadow-xs"
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="rounded-3xl border border-border bg-white p-12 text-center text-xs text-muted-foreground">
          Denemeler yükleniyor...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center space-y-3">
          <GraduationCap className="mx-auto size-8 text-muted-foreground/50" />
          <div className="text-sm font-semibold text-ink">Henüz kayıtlı deneme sınavı yok</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Öğrencilerinize sınav simülasyonu sunmak için soru bankasından deneme oluşturabilirsiniz.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
          >
            <Plus className="size-4" /> Deneme Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-white p-5 shadow-xs transition-all hover:border-border/80"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-forest/5 border border-forest/15 px-2 py-0.5 text-[11px] font-bold text-forest">
                      {m.exam}
                    </span>
                    {m.topic_mix && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {m.topic_mix}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                    {m.time_limit_minutes && (
                      <span className="flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-900 font-semibold">
                        <Timer className="size-3 text-amber-700" />
                        {m.time_limit_minutes} Dakika
                      </span>
                    )}
                    <span className="rounded bg-surface-muted px-2 py-0.5 text-ink font-semibold">
                      {m.questions?.length || 0} Soru
                    </span>
                  </div>
                </div>

                <h3 className="mt-3 text-sm font-bold text-ink">{m.title}</h3>
                {m.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {m.description}
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => onAssignMockExam?.(m)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-forest/90 transition-colors cursor-pointer shadow-xs"
                >
                  <CalendarPlus className="size-3.5" />
                  Öğrenciye Ata
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(m)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
                  >
                    <Edit className="size-3.5 text-muted-foreground" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(m.id)}
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

      {/* Editor Modal */}
      {editorOpen && editingMock && (
        <MockExamEditorModal
          initialMock={editingMock}
          onClose={() => {
            setEditorOpen(false);
            setEditingMock(null);
          }}
          onSaved={() => {
            setEditorOpen(false);
            setEditingMock(null);
            setMessage("Deneme kaydedildi.");
            refreshData();
          }}
        />
      )}
    </div>
  );
}

function MockExamEditorModal({
  initialMock,
  onClose,
  onSaved,
}: {
  initialMock: Partial<MockExam>;
  onClose: () => void;
  onSaved: (mock: MockExam) => void;
}) {
  const [form, setForm] = useState<Partial<MockExam>>({ ...initialMock });
  const [questions, setQuestions] = useState<HomeworkQuestion[]>(initialMock.questions || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim() || !form.exam?.trim()) {
      setError("Başlık ve sınav türü zorunludur.");
      return;
    }
    if (questions.length === 0) {
      setError("Lütfen denemeye en az 1 soru ekleyiniz.");
      return;
    }

    setBusy(true);
    setError("");

    const res = await saveMockExam({
      id: form.id,
      title: form.title,
      exam: form.exam,
      description: form.description || "",
      time_limit_minutes: form.time_limit_minutes || null,
      topic_mix: form.topic_mix || null,
      questions,
    });

    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error || "Deneme kaydedilemedi.");
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

  return (
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-4xl rounded-3xl border border-border bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-[#819586]" />
            <h2 className="text-base font-bold text-ink">
              {form.id ? "Denemeyi Düzenle" : "Yeni Deneme Sınavı Oluştur"}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Deneme Başlığı
              </label>
              <input
                type="text"
                required
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Örn: SAT Full Practice Test 1"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Sınav Türü
              </label>
              <input
                type="text"
                required
                value={form.exam || ""}
                onChange={(e) => setForm({ ...form, exam: e.target.value })}
                placeholder="Örn: SAT, AP, IB"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Süre Sınırı (Dakika)
              </label>
              <input
                type="number"
                min={10}
                value={form.time_limit_minutes || ""}
                onChange={(e) =>
                  setForm({ ...form, time_limit_minutes: Number(e.target.value) || null })
                }
                placeholder="Örn: 65"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Konu Dağılımı / Mix
              </label>
              <input
                type="text"
                value={form.topic_mix || ""}
                onChange={(e) => setForm({ ...form, topic_mix: e.target.value })}
                placeholder="Örn: Algebra + Advanced Math"
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Deneme Açıklaması / Kuralları
            </label>
            <textarea
              rows={2}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Öğrenciye gösterilecek sınav kuralları..."
              className="w-full rounded-xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
            />
          </div>

          {/* Questions Section */}
          <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-ink uppercase">
                  Deneme Soruları ({questions.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Soru bankasından soruları ekleyin ve sıralayın.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer"
              >
                <Layers className="size-3.5" />
                Soru Bankasından Seç
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-xs text-muted-foreground">
                Bu denemede henüz soru yok. Soru eklemek için butona tıklayınız.
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
                              : "Açık Uçlu"}
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
              {busy ? "Kaydediliyor..." : form.id ? "Denemeyi Güncelle" : "Denemeyi Kaydet"}
            </button>
          </div>
        </form>
      </div>

      {pickerOpen && (
        <MockQuestionPickerModal
          onClose={() => setPickerOpen(false)}
          onAdd={(selected) => {
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
          }}
        />
      )}
    </div>
  );
}

function MockQuestionPickerModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (questions: QuestionBankItem[]) => void;
}) {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestionBankItems({ query: search || undefined }).then((res) => {
      setItems(res.data);
      setLoading(false);
    });
  }, [search]);

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
            <p className="text-xs text-muted-foreground">Denemeye dahil edilecek soruları seçiniz.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-surface-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Soru metni veya konu ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-4 rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
        />

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
