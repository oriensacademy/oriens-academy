"use client";

import { useState, useEffect } from "react";
import type { TestimonialRow } from "@/lib/admin/content";
import {
  createAdminTestimonial,
  updateAdminTestimonial,
} from "@/lib/admin/content";
import {
  X,
  MessageSquareQuote,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Wave } from "@/components/ui/wave";
import { examRecords } from "@/content/exams";

interface TestimonialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTestimonial: TestimonialRow | null;
}

export function TestimonialModal({
  isOpen,
  onClose,
  onSaved,
  editingTestimonial,
}: TestimonialModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [quote, setQuote] = useState("");
  const [context, setContext] = useState("");
  const [examCode, setExamCode] = useState("ib");
  const [locale, setLocale] = useState("tr");
  const [active, setActive] = useState(true);
  const [verified, setVerified] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [profileImageUrl, setProfileImageUrl] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingTestimonial) {
        setName(editingTestimonial.name);
        setQuote(editingTestimonial.quote);
        setContext(editingTestimonial.context || "");
        setExamCode(editingTestimonial.exam_code || "ib");
        setLocale(editingTestimonial.locale || "tr");
        setActive(editingTestimonial.active);
        setVerified(editingTestimonial.verified);
        setFeatured(editingTestimonial.featured);
        setDisplayOrder(editingTestimonial.display_order || 0);
        setProfileImageUrl(editingTestimonial.profile_image_url || "");
      } else {
        setName("");
        setQuote("");
        setContext("");
        setExamCode("ib");
        setLocale("tr");
        setActive(true);
        setVerified(true);
        setFeatured(false);
        setDisplayOrder(0);
        setProfileImageUrl("");
      }
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [editingTestimonial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    if (!name.trim()) {
      setErrorMsg("İsim alanı boş bırakılamaz.");
      setSubmitting(false);
      return;
    }

    if (!quote.trim()) {
      setErrorMsg("Yorum metni alanı boş bırakılamaz.");
      setSubmitting(false);
      return;
    }

    if (editingTestimonial) {
      const { success, error } = await updateAdminTestimonial(editingTestimonial.id, {
        name: name.trim(),
        quote: quote.trim(),
        context: context.trim() || null,
        exam_code: examCode || null,
        locale,
        active,
        verified,
        featured,
        display_order: displayOrder,
        profile_image_url: profileImageUrl.trim() || null,
      });

      setSubmitting(false);

      if (error) {
        setErrorMsg(error);
      } else if (success) {
        setSuccessMsg("Öğrenci yorumu başarıyla güncellendi.");
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      }
    } else {
      const { error } = await createAdminTestimonial({
        name: name.trim(),
        quote: quote.trim(),
        context: context.trim() || null,
        exam_code: examCode || null,
        locale,
        active,
        verified,
        featured,
        display_order: displayOrder,
        profile_image_url: profileImageUrl.trim() || null,
      });

      setSubmitting(false);

      if (error) {
        setErrorMsg(error);
      } else {
        setSuccessMsg("Yeni öğrenci yorumu başarıyla eklendi.");
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="size-5 text-[#819586]" />
            <h2 className="text-sm font-bold text-foreground">
              {editingTestimonial ? "Öğrenci Yorumunu Düzenle" : "Yeni Öğrenci Yorumu Ekle"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                İsim Soyad (Name)
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Elif S."
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Açıklama / Unvan (Context)
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Örn: IB Math AA 7, Zurich"
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Profil Görseli URL (isteğe bağlı)
            </label>
            <input
              type="url"
              value={profileImageUrl}
              onChange={(e) => setProfileImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Yorum Metni (Quote)
            </label>
            <textarea
              required
              rows={4}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Öğrenci veya velinin orijinal deneyim yorumu…"
              className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Sınav Türü
              </label>
              <select
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              >
                {examRecords.map((exam) => (
                  <option key={exam.slug} value={exam.slug}>
                    {exam.code} ({exam.slug})
                  </option>
                ))}
                <option value="general">Genel / Diğer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Dil (Locale)
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              >
                <option value="tr">Türkçe (TR)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Sıralama
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-input text-[#10271B]"
              />
              <span>Aktif / Yayınlandı</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="rounded border-input text-[#10271B]"
              />
              <span>Doğrulanmış Öğrenci</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded border-input text-[#10271B]"
              />
              <span>Öne Çıkarılan</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input bg-white px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting || !name || !quote}
              className="flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Wave className="h-4 w-8 text-amber-400" aria-label="Kaydediliyor" />
                  <span>Kaydediliyor…</span>
                </>
              ) : (
                <span>Yorumu Kaydet</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
