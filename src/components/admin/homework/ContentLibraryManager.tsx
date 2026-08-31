"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  CalendarPlus,
  Copy,
  Edit,
  ExternalLink,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  archiveHomeworkTemplate,
  CONTENT_TYPE_LABELS,
  duplicateHomeworkTemplate,
  getHomeworkTemplates,
  openHomeworkAttachment,
  type HomeworkContentType,
  type HomeworkTemplate,
} from "@/lib/homework";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";

interface ContentLibraryManagerProps {
  onAssignContent: (item: HomeworkTemplate) => void;
  onEditContent: (item: HomeworkTemplate) => void;
  onCreateNew: () => void;
}

export function ContentLibraryManager({
  onAssignContent,
  onEditContent,
  onCreateNew,
}: ContentLibraryManagerProps) {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [items, setItems] = useState<HomeworkTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [actionBusy, setActionBusy] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    const res = await getHomeworkTemplates();
    if (res.error) setError(res.error);
    else setItems(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    getHomeworkTemplates().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setItems(res.data || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleDuplicate = async (id: string) => {
    setActionBusy(id);
    const res = await duplicateHomeworkTemplate(id);
    setActionBusy("");
    if (res.error) {
      setError(res.error);
    } else {
      void loadData();
    }
  };

  const handleArchive = (id: string) => {
    requestConfirmation({
      title: "İçeriği arşivle",
      description: "Bu içerik aktif kütüphaneden kaldırılacak ve arşivde korunacaktır.",
      confirmLabel: "Arşivle",
      action: async () => {
        setActionBusy(id);
        const res = await archiveHomeworkTemplate(id);
        setActionBusy("");
        if (res.error) setError(res.error); else void loadData();
      },
    });
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Type filter
      if (typeFilter !== "all") {
        const itemType = item.content_type || "homework";
        if (itemType !== typeFilter) return false;
      }

      // Exam filter
      if (examFilter !== "all") {
        const itemExam = (item.exam || item.exam_code || "").toLowerCase();
        if (itemExam !== examFilter.toLowerCase()) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSubject = (item.subject || "").toLowerCase().includes(q);
        const inId = item.id.toLowerCase().includes(q);
        if (!inTitle && !inSubject && !inId) return false;
      }

      return true;
    });
  }, [items, typeFilter, examFilter, search]);

  const uniqueExams = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const e = item.exam || item.exam_code;
      if (e) set.add(e.toLowerCase());
    });
    return Array.from(set);
  }, [items]);

  return (
    <div className="space-y-4">
      {confirmationDialog}
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başlık, konu veya ID ara..."
              className="w-full rounded-xl border border-border bg-white pl-9 pr-3.5 py-1.5 text-xs text-ink focus:border-primary focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">Tüm Türler</option>
            <option value="homework">Ödev</option>
            <option value="lesson_note">Ders Notu</option>
            <option value="worksheet">Çalışma Kağıdı</option>
            <option value="resource">Kaynak / Materyal</option>
            <option value="mock_exam">Deneme</option>
          </select>

          {/* Exam Filter */}
          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">Tüm Sınavlar</option>
            {uniqueExams.map((ex) => (
              <option key={ex} value={ex}>
                {ex.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadData}
            className="rounded-xl border border-border bg-white p-2 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer"
            title="Yenile"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Create Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="size-4" />
            Yeni İçerik Oluştur
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Library Table / List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Tür</th>
                  <th className="py-3 px-4">İçerik Başlığı</th>
                  <th className="py-3 px-4">Sınav / Konu</th>
                  <th className="py-3 px-4">Ekler / Sorular</th>
                  <th className="py-3 px-4">Dil</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const type = (item.content_type || "homework") as HomeworkContentType;
                  const typeConfig = CONTENT_TYPE_LABELS[type] || CONTENT_TYPE_LABELS.homework;
                  const questionCount = item.questions?.length || 0;
                  const hasResource = Boolean(item.resource_file_url);
                  const hasLink = Boolean(item.external_link);

                  return (
                    <tr key={item.id} className="hover:bg-surface-muted/50 transition-colors">
                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${typeConfig.badgeClass}`}
                        >
                          {typeConfig.tr}
                        </span>
                      </td>

                      {/* Title & Description */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <p className="font-semibold text-ink">{item.title}</p>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </td>

                      {/* Exam / Subject */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {(item.exam || item.exam_code) && (
                            <span className="rounded-md bg-forest/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              {(item.exam || item.exam_code)?.toUpperCase()}
                            </span>
                          )}
                          <span className="text-muted-foreground text-xs">
                            {item.subject || "Genel"}
                          </span>
                        </div>
                      </td>

                      {/* Questions / Attachments */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {type === "lesson_note" || type === "resource" ? (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Not / Materyal
                            </span>
                          ) : (
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-ink">
                              {questionCount} Soru
                            </span>
                          )}

                          {hasResource && (
                            <button
                              type="button"
                              onClick={() => void openHomeworkAttachment(item.resource_file_url!)}
                              className="text-primary hover:text-forest p-0.5 cursor-pointer"
                              title={item.attachment_name || "Kaynak Dosyası"}
                            >
                              <Paperclip className="size-3.5" />
                            </button>
                          )}

                          {hasLink && (
                            <a
                              href={item.external_link!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-forest p-0.5"
                              title="Harici Bağlantı"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Language */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="uppercase text-[10px] font-bold text-muted-foreground">
                          {item.language || "TR"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onAssignContent(item)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-forest cursor-pointer transition-colors shadow-2xs"
                          >
                            <CalendarPlus className="size-3" />
                            Atama Yap
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditContent(item)}
                            className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer transition-colors"
                            title="Düzenle"
                          >
                            <Edit className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={actionBusy === item.id}
                            onClick={() => void handleDuplicate(item.id)}
                            className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink cursor-pointer transition-colors disabled:opacity-50"
                            title="Çoğalt"
                          >
                            <Copy className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={actionBusy === item.id}
                            onClick={() => void handleArchive(item.id)}
                            className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-50"
                            title="Arşivle"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground bg-surface-muted/30">
          Aramanıza uygun içerik veya materyal bulunamadı.
        </div>
      )}
    </div>
  );
}
