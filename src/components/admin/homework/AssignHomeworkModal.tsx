"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Check,
  Mail,
  Search,
  X,
} from "lucide-react";
import {
  assignTemplateToStudents,
  getHomeworkTemplates,
  type HomeworkTemplate,
} from "@/lib/homework";
import { getSupabaseClient } from "@/lib/supabase/client";

interface StudentOption {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  targetExam: string | null;
}

export function AssignHomeworkModal({
  isOpen,
  initialTemplate,
  lockedStudentId,
  lockedStudentName,
  lockedStudentEmail,
  lessons = [],
  onClose,
  onAssigned,
}: {
  isOpen: boolean;
  initialTemplate?: HomeworkTemplate | null;
  lockedStudentId?: string;
  lockedStudentName?: string;
  lockedStudentEmail?: string;
  lessons?: Array<{ id: string; title: string }>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [templates, setTemplates] = useState<HomeworkTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => initialTemplate?.id || ""
  );

  // Student selection state (for multi/unlocked mode)
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() =>
    lockedStudentId ? [lockedStudentId] : []
  );
  const [studentSearch, setStudentSearch] = useState("");

  // Assignment metadata
  const [dueDate, setDueDate] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [customTitle, setCustomTitle] = useState(
    () => initialTemplate?.title || ""
  );
  const [customInstructions, setCustomInstructions] = useState(
    () => initialTemplate?.description || ""
  );
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Body scroll lock & Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    if (!initialTemplate) {
      getHomeworkTemplates().then((res) => {
        setTemplates(res.data);
        if (res.data.length > 0) {
          setSelectedTemplateId((prev) => prev || res.data[0].id);
          setCustomTitle((prev) => prev || res.data[0].title);
          setCustomInstructions((prev) => prev || res.data[0].description);
        }
      });
    }

    if (!lockedStudentId) {
      const client = getSupabaseClient();
      client
        .from("student_profiles" as never)
        .select("id, full_name, email, phone, target_exam")
        .eq("active", true)
        .order("full_name", { ascending: true })
        .then((res) => {
          if (res.data) {
            const raw = res.data as unknown as Array<{
              id: string;
              full_name: string | null;
              email: string;
              phone: string | null;
              target_exam: string | null;
            }>;
            setAvailableStudents(
              raw.map((r) => ({
                id: r.id,
                fullName: r.full_name || "İsimsiz Öğrenci",
                email: r.email,
                phone: r.phone,
                targetExam: r.target_exam,
              }))
            );
          }
        });
    }
  }, [isOpen, initialTemplate, lockedStudentId]);

  if (!isOpen) return null;

  const handleTemplateChange = (tId: string) => {
    setSelectedTemplateId(tId);
    const found = templates.find((t) => t.id === tId) || initialTemplate;
    if (found) {
      setCustomTitle(found.title);
      setCustomInstructions(found.description);
    }
  };

  const toggleStudent = (sId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(sId) ? prev.filter((i) => i !== sId) : [...prev, sId]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudentIds.length === availableStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(availableStudents.map((s) => s.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) {
      setError("Lütfen bir ödev şablonu seçiniz.");
      return;
    }
    if (selectedStudentIds.length === 0) {
      setError("Lütfen ödev atanacak en az bir öğrenci seçiniz.");
      return;
    }

    setBusy(true);
    setError("");

    const res = await assignTemplateToStudents({
      templateId: selectedTemplateId,
      studentIds: selectedStudentIds,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      lessonId: lessonId || null,
      customTitle: customTitle || null,
      customInstructions: customInstructions || null,
      sendEmail,
    });

    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      onAssigned();
      onClose();
    }
  };

  const filteredStudents = availableStudents.filter((s) => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-[150] min-h-[100dvh] w-screen flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-2xl rounded-3xl border border-border bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-[#819586]" />
            <h2 className="text-base font-bold text-ink">Ödev / Deneme Ata</h2>
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
          {/* Target Student Identity (Locked or Multi-Select) */}
          {lockedStudentId ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white text-xs">
                  {lockedStudentName?.charAt(0) || "Ö"}
                </div>
                <div>
                  <div className="text-xs font-bold text-ink">{lockedStudentName}</div>
                  <div className="text-[11px] text-muted-foreground">{lockedStudentEmail}</div>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Seçili Öğrenci Kilitli
              </span>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-border bg-surface-muted/30 p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase text-muted-foreground">
                  Öğrenci Seçimi ({selectedStudentIds.length} seçildi)
                </label>
                <button
                  type="button"
                  onClick={selectAllStudents}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {selectedStudentIds.length === availableStudents.length
                    ? "Seçimi Kaldır"
                    : "Tümünü Seç"}
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Öğrenci ara..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full rounded-xl border border-input bg-white pl-8 pr-3 py-1.5 text-xs outline-hidden focus:border-primary"
                />
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {filteredStudents.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors ${
                        isChecked
                          ? "border-primary bg-primary/5 font-semibold text-ink"
                          : "border-border bg-white text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudent(st.id)}
                          className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
                        />
                        <span>{st.fullName}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({st.email})
                        </span>
                      </div>
                      {st.targetExam && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">
                          {st.targetExam}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Template Selector */}
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Atanacak İçerik / Ödev / Materyal
            </label>
            {initialTemplate ? (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-ink">{initialTemplate.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {initialTemplate.content_type === "lesson_note"
                      ? "Ders Notu"
                      : initialTemplate.content_type === "resource"
                      ? "Kaynak / Materyal"
                      : `${initialTemplate.exam || "Genel"} · ${initialTemplate.questions?.length || 0} Soru`}
                  </div>
                </div>
                <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[10px] font-bold text-forest">
                  Seçili İçerik
                </span>
              </div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary font-medium"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.content_type === "lesson_note" ? "Ders Notu" : t.content_type === "resource" ? "Materyal" : t.content_type === "worksheet" ? "Çalışma Kağıdı" : t.content_type === "mock_exam" ? "Deneme" : "Ödev"}] {t.title} ({t.exam || "Genel"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title & Instructions Override */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Ödev Başlığı (İsteğe Bağlı Özelleştirin)
              </label>
              <input
                type="text"
                required
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Yönerge & Açıklama
              </label>
              <textarea
                rows={2}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full rounded-xl border border-input p-3 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>
          </div>

          {/* Due Date & Lesson Link */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Son Teslim Tarihi
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-input px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                İlgili Ders / Randevu Bağlantısı (İsteğe Bağlı)
              </label>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
              >
                <option value="">Bağlantılı ders yok</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email Notification Toggle */}
          <label className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/30 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
            />
            <div className="flex items-center gap-1.5 text-xs text-ink">
              <Mail className="size-4 text-muted-foreground" />
              <span>
                Öğrenciye <strong>&quot;Yeni Ödeviniz Var&quot;</strong> e-posta bildirimi gönder
              </span>
            </div>
          </label>

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
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Check className="size-4" />
              {busy ? "Atanıyor..." : "Ödevi Ata"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
