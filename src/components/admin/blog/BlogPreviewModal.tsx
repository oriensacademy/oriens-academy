"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { ArticleShell } from "@/components/blog/ArticleShell";
import { localizedPath } from "@/lib/routes";
import { sanitizeBlogContentJson, type BlogBlock } from "@/lib/blog/blockSchema";
import type { BlogPostRow } from "@/lib/admin/blog";
import { lockBodyScroll } from "@/lib/dom/body-scroll-lock";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

/**
 * Frame widths, not media queries: the preview renders the real article inside
 * a constrained container so the same Tailwind breakpoints the public page uses
 * actually fire. Mobile is under `sm`, tablet lands between `sm` and `lg`, so a
 * side-by-side block visibly stacks at the mobile width.
 */
const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: "w-full",
  tablet: "w-[820px] max-w-full",
  mobile: "w-[390px] max-w-full",
};

const DEVICE_OPTIONS: { value: PreviewDevice; label: string; icon: typeof Monitor }[] = [
  { value: "desktop", label: "Masaüstü", icon: Monitor },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "mobile", label: "Mobil", icon: Smartphone },
];

export interface PreviewSource {
  locale: "tr" | "en";
  title: string;
  excerpt: string;
  blocks: BlogBlock[];
  coverImageUrl: string;
  authorName: string;
  publishedAt: string | null;
  slug: string;
}

/**
 * Live preview of the *current, unsaved* editor state.
 *
 * It renders through ArticleShell -- the exact component the public article
 * page uses -- so preview and production share one renderer and one block
 * schema. Nothing is saved, published or fetched to open this: the editor
 * state is turned into the same shape a row from `blog_posts` would have.
 */
export function BlogPreviewModal({ source, onClose }: { source: PreviewSource; onClose: () => void }) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const unlockBodyScroll = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [onClose]);

  const post = useMemo<BlogPostRow>(() => {
    // Re-validated through the same sanitizer the public page runs, so the
    // preview also shows exactly which blocks would survive a save.
    const safe = sanitizeBlogContentJson({ version: 1, blocks: source.blocks });
    const now = new Date().toISOString();
    return {
      id: "preview",
      slug: source.slug || "onizleme",
      locale: source.locale,
      title: source.title.trim() || (source.locale === "tr" ? "Başlıksız yazı" : "Untitled post"),
      excerpt: source.excerpt.trim(),
      content: "",
      content_json: safe as unknown as BlogPostRow["content_json"],
      cover_image_url: source.coverImageUrl || null,
      author_name: source.authorName.trim() || null,
      status: "draft",
      published_at: source.publishedAt || now,
      created_at: now,
      updated_at: now,
    };
  }, [source]);

  const hasContent = Boolean(post.content_json);
  const articleUrl = `https://oriens-academy.com${localizedPath("blog", source.locale)}${post.slug}/`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Yazı önizlemesi"
      className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink">Önizleme</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
            Kaydedilmemiş değişiklikler dahil
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {DEVICE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDevice(value)}
                aria-pressed={device === value}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  device === value ? "bg-ink text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-ink transition hover:bg-muted"
          >
            <X className="size-4" />
            Kapat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-neutral-200 p-4 sm:p-6">
        <div className={`mx-auto overflow-hidden rounded-2xl bg-background shadow-2xl transition-[width] ${DEVICE_WIDTH[device]}`}>
          {hasContent || post.cover_image_url ? (
            <ArticleShell post={post} locale={source.locale} articleUrl={articleUrl} />
          ) : (
            <div className="px-6 py-24 text-center">
              <p className="text-sm font-semibold text-ink">Önizlenecek içerik yok</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Editöre en az bir blok ekleyin. Boş bloklar yayında görünmediği için önizlemede de gösterilmez.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
