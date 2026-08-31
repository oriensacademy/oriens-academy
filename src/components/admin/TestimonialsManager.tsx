"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { TestimonialModal } from "@/components/admin/TestimonialModal";
import type { TestimonialRow } from "@/lib/admin/content";
import {
  listAdminTestimonials,
  updateAdminTestimonial,
  setAdminTestimonialFeatured,
  archiveAdminTestimonial,
} from "@/lib/admin/content";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Archive,
  Pin,
  Inbox,
  Filter,
  Award,
  Search,
  Eye,
  EyeOff,
  Star,
  FileText,
  Copy,
  Check,
  X,
  Calendar,
} from "lucide-react";

export function TestimonialsManager() {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [localeFilter, setLocaleFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");

  // Full Text Preview Modal
  const [previewItem, setPreviewItem] = useState<TestimonialRow | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialRow | null>(null);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminTestimonials({
      locale: localeFilter !== "all" ? localeFilter : undefined,
    });
    setLoading(false);
    if (error) setErrorMsg(error);
    else setTestimonials(data);
  }, [localeFilter]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);
      listAdminTestimonials({
        locale: localeFilter !== "all" ? localeFilter : undefined,
      }).then(({ data, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) setErrorMsg(error);
          else setTestimonials(data);
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [localeFilter]);

  // Fast Toggle Active Status (Hide without delete)
  const handleToggleActive = async (item: TestimonialRow) => {
    setSavingId(item.id);
    const { success, error } = await updateAdminTestimonial(item.id, {
      active: !item.active,
    });
    setSavingId(null);
    if (error) setErrorMsg(error);
    else if (success) {
      setTestimonials((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, active: !item.active } : t))
      );
    }
  };

  // Fast Toggle Featured Status (Pin / Feature)
  const handleToggleFeatured = async (item: TestimonialRow) => {
    setSavingId(item.id);
    const { success, error } = await setAdminTestimonialFeatured(item.id, !item.featured);
    setSavingId(null);
    if (error) setErrorMsg(error);
    else if (success) {
      setTestimonials((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, featured: !item.featured } : t))
      );
    }
  };

  const handleTogglePinned = async (item: TestimonialRow) => {
    setSavingId(item.id);
    const nextPinnedAt = item.pinned_at ? null : new Date().toISOString();
    const { success, error } = await updateAdminTestimonial(item.id, {
      pinned_at: nextPinnedAt,
      pin_order: nextPinnedAt ? (item.pin_order ?? 0) : null,
    });
    setSavingId(null);
    if (error) setErrorMsg(error);
    else if (success) {
      setTestimonials((previous) => previous.map((row) => row.id === item.id ? { ...row, pinned_at: nextPinnedAt, pin_order: nextPinnedAt ? (row.pin_order ?? 0) : null } : row));
    }
  };

  // Update Display Order
  const handleUpdateDisplayOrder = async (item: TestimonialRow, newOrder: number) => {
    if (isNaN(newOrder)) return;
    setSavingId(item.id);
    const { success, error } = await updateAdminTestimonial(item.id, {
      display_order: newOrder,
    });
    setSavingId(null);
    if (error) setErrorMsg(error);
    else if (success) {
      setTestimonials((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, display_order: newOrder } : t))
      );
    }
  };

  const handleArchive = (id: string, name: string) => {
    requestConfirmation({
      title: "Yorumu arşivle",
      description: `"${name}" isimli yorum public görünümden kaldırılacak; korunan kaynak metni silinmeyecektir.`,
      confirmLabel: "Arşivle",
      action: async () => {
        setDeletingId(id);
        const { success, error } = await archiveAdminTestimonial(id);
        setDeletingId(null);
        if (error) setErrorMsg(error);
        else if (success) setTestimonials((prev) => prev.map((item) => item.id === id ? { ...item, active: false, archived_at: new Date().toISOString() } : item));
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered & Searched Testimonials
  const filteredTestimonials = useMemo(() => {
    return testimonials.filter((item) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rawTopic = (item as unknown as { source_topic?: string }).source_topic || "";
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesQuote = item.quote.toLowerCase().includes(q);
        const matchesTopic = (item.context || "").toLowerCase().includes(q) || rawTopic.toLowerCase().includes(q);
        const matchesExam = (item.exam_code || "").toLowerCase().includes(q);
        if (!matchesName && !matchesQuote && !matchesTopic && !matchesExam) return false;
      }

      // Year filter
      if (yearFilter !== "all") {
        const itemYear = item.created_at ? new Date(item.created_at).getFullYear().toString() : "";
        if (itemYear !== yearFilter) return false;
      }

      // Status filter
      if (statusFilter === "featured" && !item.featured) return false;
      if (statusFilter === "pinned" && !item.pinned_at) return false;
      if (statusFilter === "active" && !item.active) return false;
      if (statusFilter === "hidden" && item.active) return false;

      // Topic filter
      if (topicFilter !== "all") {
        const rawTopic = (item as unknown as { source_topic?: string }).source_topic || "";
        const combined = `${item.context || ""} ${rawTopic}`.toLowerCase();
        if (topicFilter === "lise" && !combined.includes("lise")) return false;
        if (topicFilter === "universite" && !combined.includes("üniversite") && !combined.includes("university")) return false;
        if (topicFilter === "sinav" && !combined.includes("sınav") && !combined.includes("exam") && !item.exam_code) return false;
        if (topicFilter === "ib" && !combined.includes("ib") && item.exam_code !== "ib") return false;
        if (topicFilter === "ap" && !combined.includes("ap") && item.exam_code !== "ap") return false;
        if (topicFilter === "sat" && !combined.includes("sat") && item.exam_code !== "sat") return false;
      }

      return true;
    });
  }, [testimonials, searchQuery, yearFilter, statusFilter, topicFilter]);

  // Statistics
  const totalCount = testimonials.length;
  const activeCount = testimonials.filter((t) => t.active).length;
  const featuredCount = testimonials.filter((t) => t.featured).length;
  const hiddenCount = testimonials.filter((t) => !t.active).length;

  return (
    <div className="space-y-4">
      {confirmationDialog}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" data-testid="featured-testimonial-count">
        Public ana sayfa seçimi: {featuredCount}/20
      </div>
      {/* Action, Search and Filter Bar */}
      <div className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-xs">
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Öğrenci adı, ders konusu veya yorum metninde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-white pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#10271B] focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={fetchTestimonials}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
              <span>Yenile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTestimonial(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C]"
            >
              <Plus className="size-3.5" />
              <span>Yeni Yorum Ekle</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/60 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
            <Filter className="size-3.5 text-[#10271B]" />
            <span>Filtreler:</span>
          </div>

          {/* Locale Filter */}
          <select
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value)}
            className="rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
          >
            <option value="all">Tüm Diller</option>
            <option value="tr">Türkçe (TR)</option>
            <option value="en">English (EN)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="featured">★ Sadece Öne Çıkanlar ({featuredCount})</option>
            <option value="pinned">Sadece Sabitlenenler</option>
            <option value="active">Aktif Olanlar ({activeCount})</option>
            <option value="hidden">Gizlenenler ({hiddenCount})</option>
          </select>

          {/* Topic Filter */}
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
          >
            <option value="all">Tüm Konular / Branşlar</option>
            <option value="lise">Lise Takviye</option>
            <option value="universite">Üniversite Takviye</option>
            <option value="sinav">Sınav Hazırlık</option>
            <option value="ib">International Baccalaureate (IB)</option>
            <option value="ap">Advanced Placement (AP)</option>
            <option value="sat">SAT / GRE / GMAT</option>
          </select>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
          >
            <option value="all">Tüm Yıllar (2017 - 2025)</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
            <option value="2021">2021</option>
            <option value="2020">2020</option>
            <option value="2019">2019</option>
            <option value="2018">2018</option>
            <option value="2017">2017</option>
          </select>

          {(searchQuery || localeFilter !== "all" || yearFilter !== "all" || statusFilter !== "all" || topicFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setLocaleFilter("all");
                setYearFilter("all");
                setStatusFilter("all");
                setTopicFilter("all");
              }}
              className="text-[11px] font-semibold text-brand-accent hover:underline ml-auto"
            >
              Filtreleri Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={fetchTestimonials}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Öğrenci yorumları yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && filteredTestimonials.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Eşleşen Öğrenci Yorumu Bulunamadı
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Seçili arama veya filtre kriterlerine uygun öğrenci değerlendirmesi bulunamadı. Filtreleri temizleyerek tüm yorumları görebilirsiniz.
          </p>
        </div>
      )}

      {/* Testimonials Table */}
      {!loading && !errorMsg && filteredTestimonials.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">Sıra</th>
                  <th className="px-4 py-3">Öğrenci / Veli</th>
                  <th className="px-4 py-3">Ders / Konu</th>
                  <th className="px-4 py-3">Alıntı Metni</th>
                  <th className="px-3 py-3 text-center">Öne Çıkar</th>
                  <th className="px-3 py-3 text-center">Sabitle</th>
                  <th className="px-3 py-3 text-center">Görünürlük</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTestimonials.map((item) => {
                  const createdDate = item.created_at ? new Date(item.created_at) : null;
                  const dateFormatted = createdDate
                    ? createdDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })
                    : "";

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-background-soft/80 ${
                        !item.active ? "opacity-60 bg-muted/30" : ""
                      } ${item.featured ? "bg-amber-50/30" : ""}`}
                    >
                      {/* Display Order */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="number"
                          defaultValue={item.display_order ?? 0}
                          onBlur={(e) => handleUpdateDisplayOrder(item, parseInt(e.target.value, 10))}
                          className="w-10 rounded border border-input bg-white px-1 py-0.5 text-center text-xs font-semibold text-foreground focus:border-[#10271B] focus:outline-hidden"
                          title="Görüntüleme sırasını değiştirmek için düzenleyin"
                        />
                      </td>

                      {/* Name & Date */}
                      <td className="px-4 py-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.featured && <Star className="size-3 fill-amber-400 text-amber-500 shrink-0" />}
                        </div>
                        {dateFormatted && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-normal mt-0.5">
                            <Calendar className="size-2.5" />
                            <span>{dateFormatted}</span>
                          </div>
                        )}
                      </td>

                      {/* Topic & Exam Badge */}
                      <td className="px-4 py-3.5">
                        <div className="max-w-[200px] truncate text-[11px] text-muted-foreground" title={item.context || ""}>
                          {item.context || "Genel Takviye"}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {item.exam_code && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-bold text-foreground uppercase">
                              <Award className="size-2.5 text-[#819586]" />
                              <span>{item.exam_code}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                            {item.locale}
                          </span>
                        </div>
                      </td>

                      {/* Quote Snippet */}
                      <td className="px-4 py-3.5 max-w-sm">
                        <p className="line-clamp-2 text-foreground font-sans italic text-[11px]">
                          &quot;{item.quote}&quot;
                        </p>
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-accent hover:underline"
                        >
                          <FileText className="size-2.5" />
                          <span>Tam Metni Gör ({item.quote.length} karakter)</span>
                        </button>
                      </td>

                      {/* Featured Star Toggle */}
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(item)}
                          disabled={savingId === item.id}
                          className={`inline-flex items-center justify-center size-7 rounded-lg border transition-colors ${
                            item.featured
                              ? "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "border-border bg-white text-muted-foreground hover:bg-muted"
                          }`}
                          title={item.featured ? "Öne Çıkarıldı (Kaldırmak için tıklayın)" : "Öne Çıkar"}
                        >
                          <Star className={`size-3.5 ${item.featured ? "fill-amber-500 text-amber-600" : ""}`} />
                        </button>
                      </td>

                      {/* Optional deterministic pin */}
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePinned(item)}
                          disabled={savingId === item.id}
                          className={`inline-flex size-7 items-center justify-center rounded-lg border ${item.pinned_at ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-white text-muted-foreground hover:bg-muted"}`}
                          title={item.pinned_at ? "Sabitlemeyi kaldır" : "Yorumu sabitle"}
                        >
                          <Pin className={`size-3.5 ${item.pinned_at ? "fill-current" : ""}`} />
                        </button>
                      </td>

                      {/* Active / Hide Toggle */}
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          disabled={savingId === item.id}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                            item.active
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                          }`}
                          title={item.active ? "Aktif (Gizlemek için tıklayın)" : "Gizli (Aktif etmek için tıklayın)"}
                        >
                          {item.active ? (
                            <>
                              <Eye className="size-3" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="size-3" />
                              <span>Gizli</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTestimonial(item);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                            title="Düzenle"
                          >
                            <Pencil className="size-3" />
                            <span>Düzenle</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchive(item.id, item.name)}
                            disabled={deletingId === item.id}
                            className="inline-flex items-center justify-center size-7 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                            title="Arşivle (kaynak metin silinmez)"
                          >
                            <Archive className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border bg-background-soft px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Gösterilen: <strong>{filteredTestimonials.length}</strong> / Toplam: <strong>{totalCount}</strong> yorum
            </span>
            <span className="text-[11px]">
              Tüm yorumlar güvenli şekilde şifrelenip indekslenmiştir.
            </span>
          </div>
        </div>
      )}

      {/* Full Text Untouched Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-lg text-foreground">
                    {previewItem.name}
                  </h3>
                  {previewItem.featured && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      <Star className="size-2.5 fill-amber-500 text-amber-600" />
                      Öne Çıkan
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewItem.context || "Özel Ders"} · {previewItem.locale.toUpperCase()} ·{" "}
                  {previewItem.created_at ? new Date(previewItem.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Orijinal Kaynak Yorum Metni:
              </p>
              <blockquote className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                {previewItem.quote}
              </blockquote>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => copyToClipboard(previewItem.quote)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                <span>{copied ? "Metin Kopyalandı!" : "Metni Kopyala"}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const item = previewItem;
                    setPreviewItem(null);
                    setEditingTestimonial(item);
                    setIsModalOpen(true);
                  }}
                  className="rounded-lg bg-[#10271B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0D2A1C]"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-lg border border-border bg-white px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Testimonial Modal */}
      <TestimonialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchTestimonials}
        editingTestimonial={editingTestimonial}
      />
    </div>
  );
}
