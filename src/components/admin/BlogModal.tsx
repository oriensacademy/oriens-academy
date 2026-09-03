"use client";

import { useState, useEffect } from "react";
import type { BlogPostRow, BlogPostStatus, BlogLocale } from "@/lib/admin/blog";
import { createAdminBlogPost, updateAdminBlogPost, normalizeBlogSlug } from "@/lib/admin/blog";
import { renderBlogMarkdown } from "@/lib/blog/markdown";
import {
  X,
  Newspaper,
  AlertCircle,
  CheckCircle2,
  Eye,
  Pencil,
} from "lucide-react";
import { Wave } from "@/components/ui/wave";

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingPost: BlogPostRow | null;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function BlogModal({ isOpen, onClose, onSaved, editingPost }: BlogModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const [locale, setLocale] = useState<BlogLocale>("tr");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [status, setStatus] = useState<BlogPostStatus>("draft");
  const [publishedAt, setPublishedAt] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingPost) {
        setLocale(editingPost.locale as BlogLocale);
        setTitle(editingPost.title || "");
        setSlug(editingPost.slug || "");
        setSlugTouched(true);
        setExcerpt(editingPost.excerpt || "");
        setContent(editingPost.content || "");
        setCoverImageUrl(editingPost.cover_image_url || "");
        setAuthorName(editingPost.author_name || "");
        setStatus(editingPost.status as BlogPostStatus);
        setPublishedAt(toDatetimeLocal(editingPost.published_at));
      } else {
        setLocale("tr");
        setTitle("");
        setSlug("");
        setSlugTouched(false);
        setExcerpt("");
        setContent("");
        setCoverImageUrl("");
        setAuthorName("");
        setStatus("draft");
        setPublishedAt("");
      }
      setErrorMsg(null);
      setSuccessMsg(null);
      setPreview(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [editingPost, isOpen]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugTouched) setSlug(normalizeBlogSlug(val));
  };

  const handleSlugChange = (val: string) => {
    setSlugTouched(true);
    setSlug(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim() || !slug.trim() || !excerpt.trim() || !content.trim()) {
      setErrorMsg("Başlık, slug, özet ve içerik zorunludur.");
      return;
    }

    setSubmitting(true);

    const input = {
      locale,
      slug: normalizeBlogSlug(slug),
      title,
      excerpt,
      content,
      cover_image_url: coverImageUrl.trim() || null,
      author_name: authorName.trim() || null,
      status,
      published_at: fromDatetimeLocal(publishedAt),
    };

    if (editingPost) {
      const { success, error } = await updateAdminBlogPost(editingPost.id, input);
      setSubmitting(false);
      if (error) {
        setErrorMsg(error);
      } else if (success) {
        setSuccessMsg("Yazı başarıyla güncellendi.");
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      }
    } else {
      const { error } = await createAdminBlogPost(input);
      setSubmitting(false);
      if (error) {
        setErrorMsg(error);
      } else {
        setSuccessMsg("Yeni yazı başarıyla oluşturuldu.");
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
      <div className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 max-h-[90dvh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="size-5 text-[#819586]" />
            <h2 className="text-sm font-bold text-foreground">
              {editingPost ? "Blog Yazısını Düzenle" : "Yeni Blog Yazısı Ekle"}
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
          <div className="flex gap-2">
            {(["tr", "en"] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  locale === loc
                    ? "border-[#10271B] bg-[#10271B] text-white"
                    : "border-input bg-white text-muted-foreground hover:bg-muted"
                }`}
              >
                {loc === "tr" ? "Türkçe" : "English"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextField label="Başlık" value={title} onChange={handleTitleChange} required />
            <AdminTextField label="Slug (URL)" value={slug} onChange={handleSlugChange} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Özet *</label>
            <textarea
              required
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-semibold text-muted-foreground">İçerik (Markdown) *</label>
              <button
                type="button"
                onClick={() => setPreview((p) => !p)}
                className="flex items-center gap-1 rounded-lg border border-input bg-white px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
              >
                {preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}
                {preview ? "Düzenle" : "Önizle"}
              </button>
            </div>
            {preview ? (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-input bg-surface-muted/40 p-4">
                {content.trim() ? renderBlogMarkdown(content) : (
                  <p className="text-xs text-muted-foreground">Önizlenecek içerik yok.</p>
                )}
              </div>
            ) : (
              <textarea
                required
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Başlık&#10;&#10;Paragraf metni, **kalın**, *italik*, [bağlantı](https://...)"
                className="w-full rounded-lg border border-input bg-white p-2 font-mono text-xs text-foreground"
              />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextField label="Kapak Görseli URL" value={coverImageUrl} onChange={setCoverImageUrl} />
            <AdminTextField label="Yazar Adı" value={authorName} onChange={setAuthorName} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BlogPostStatus)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              >
                <option value="draft">Taslak</option>
                <option value="published">Yayında</option>
                <option value="archived">Arşivlendi</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Yayın Tarihi</label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-3 border-t border-border sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-input bg-white px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer sm:w-auto"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C] disabled:opacity-50 cursor-pointer sm:w-auto"
            >
              {submitting ? (
                <>
                  <Wave className="h-4 w-8 text-amber-400" aria-label="Kaydediliyor" />
                  <span>Kaydediliyor…</span>
                </>
              ) : (
                <span>Yazıyı Kaydet</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminTextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground">
      {label}
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
      />
    </label>
  );
}
