"use client";

import { useState, useEffect, useCallback } from "react";
import { TestimonialModal } from "@/components/admin/TestimonialModal";
import type { TestimonialRow } from "@/lib/admin/content";
import {
  listAdminTestimonials,
  updateAdminTestimonial,
  deleteAdminTestimonial,
} from "@/lib/admin/content";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  FileText,
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
  Inbox,
  Filter,
  Globe,
  Award,
} from "lucide-react";

export default function AdminContentPage() {
  return <ContentContent />;
}

function ContentContent() {
  const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters State
  const [localeFilter, setLocaleFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialRow | null>(null);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleToggleActive = async (item: TestimonialRow) => {
    const { success, error } = await updateAdminTestimonial(item.id, {
      active: !item.active,
    });
    if (error) setErrorMsg(error);
    else if (success) fetchTestimonials();
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmDelete = window.confirm(`"${name}" isimli öğrenci yorumunu silmek istediğinize emin misiniz?`);
    if (!confirmDelete) return;

    setDeletingId(id);
    const { success, error } = await deleteAdminTestimonial(id);
    setDeletingId(null);

    if (error) setErrorMsg(error);
    else if (success) fetchTestimonials();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Öğrenci Yorumları & İçerik Yönetimi / Content
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Web sitesindeki gerçek öğrenci deneyimlerini, sınav sonuçlarını ve değerlendirmeleri yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTestimonials}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4" />
            <span>Yeni Yorum Ekle</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="size-4 text-[#10271B]" />
          <span>Filtrele:</span>
        </div>

        <select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value)}
          className="rounded-lg border border-input bg-white px-3 py-1.5 text-xs text-foreground focus:border-[#10271B] focus:outline-hidden"
        >
          <option value="all">Tüm Diller / All Locales</option>
          <option value="tr">Türkçe (TR)</option>
          <option value="en">English (EN)</option>
        </select>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
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
      {!loading && !errorMsg && testimonials.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">
            Henüz Öğrenci Yorumu Bulunmuyor / No Testimonials
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Veritabanında henüz öğrenci yorumu kaydı yok. &quot;Yeni Yorum Ekle&quot; butonunu kullanarak ilk öğrenci değerlendirmesini ekleyebilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingTestimonial(null);
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4" />
            <span>İlk Yorumu Ekle</span>
          </button>
        </div>
      )}

      {/* List (Desktop Table) */}
      {!loading && !errorMsg && testimonials.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Öğrenci / Unvan</th>
                  <th className="px-4 py-3">Alıntı Özet</th>
                  <th className="px-4 py-3">Sınav & Dil</th>
                  <th className="px-4 py-3">Rozetler</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {testimonials.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-background-soft/80"
                  >
                    <td className="px-4 py-3.5 font-semibold text-foreground">
                      <div>{item.name}</div>
                      {item.context && (
                        <div className="text-[11px] text-muted-foreground font-normal">
                          {item.context}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 max-w-xs truncate text-muted-foreground font-sans italic">
                      &quot;{item.quote}&quot;
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground uppercase">
                          <Award className="size-3 text-[#819586]" />
                          <span>{item.exam_code || "Genel"}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase">
                          <Globe className="size-3 text-muted-foreground" />
                          <span>{item.locale}</span>
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {item.verified && (
                          <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                            Doğrulanmış
                          </span>
                        )}
                        {item.featured && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Sparkles className="size-3 text-amber-600" />
                            <span>Öne Çıkan</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                          item.active
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        <CheckCircle2 className="size-3" />
                        <span>{item.active ? "Aktif" : "Pasif"}</span>
                      </button>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTestimonial(item);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="size-3 text-muted-foreground" />
                        <span>Düzenle</span>
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id, item.name)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === item.id ? (
                          <Wave className="h-3 w-6" aria-label="Siliniyor" />
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                        <span>Sil</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <TestimonialModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTestimonial(null);
        }}
        onSaved={fetchTestimonials}
        editingTestimonial={editingTestimonial}
      />
    </div>
  );
}
