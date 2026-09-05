"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Check, Eye, Save, Send, UploadCloud, X } from "lucide-react";
import {
  createAdminBlogPost,
  getAdminBlogPost,
  normalizeBlogSlug,
  publishAdminBlogPost,
  updateAdminBlogPost,
  uploadAdminBlogMedia,
  type BlogLocale,
  type BlogPostInput,
  type BlogPostStatus,
} from "@/lib/admin/blog";
import { BlockEditor } from "@/components/admin/blog/BlockEditor";
import { BlogPreviewModal } from "@/components/admin/blog/BlogPreviewModal";
import { sanitizeBlogContentJson, deriveLegacyContentFallback, type BlogBlock } from "@/lib/blog/blockSchema";
import { Wave } from "@/components/ui/wave";

type SaveState = "idle" | "saving" | "saved" | "error";
interface EditorForm {
  locale: BlogLocale;
  title: string;
  excerpt: string;
  blocks: BlogBlock[];
  coverImageUrl: string;
  authorName: string;
  status: BlogPostStatus;
  publishedAt: string;
}

const EMPTY_FORM: EditorForm = {
  locale: "tr", title: "", excerpt: "", blocks: [], coverImageUrl: "", authorName: "", status: "draft", publishedAt: "",
};

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BlogEditorPage() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(Boolean(queryId));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Render-safe mirrors of existingSlugRef / wasPublishedRef. The refs stay the
  // source of truth inside the save chain (they must not trigger re-renders
  // mid-save); these are what the UI is allowed to read.
  const [persistedSlug, setPersistedSlug] = useState("");
  const [everPublished, setEverPublished] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [renderTime] = useState(() => Date.now());
  const postIdRef = useRef<string | null>(queryId);
  const existingSlugRef = useRef("");
  const wasPublishedRef = useRef(false);
  const persistedStatusRef = useRef<BlogPostStatus>("draft");
  const persistedPublishedAtRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    if (!queryId) {
      initializedRef.current = true;
      return;
    }
    void getAdminBlogPost(queryId).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !data) {
        setError(loadError || "Yazı bulunamadı.");
      } else {
        existingSlugRef.current = data.slug;
        wasPublishedRef.current = data.status === "published";
        setPersistedSlug(data.slug);
        setEverPublished(data.status === "published");
        persistedStatusRef.current = data.status as BlogPostStatus;
        persistedPublishedAtRef.current = data.published_at;
        const sanitized = sanitizeBlogContentJson(data.content_json);
        setForm({
          locale: data.locale as BlogLocale,
          title: data.title || "",
          excerpt: data.excerpt?.trim() || "",
          blocks: sanitized ? sanitized.blocks : [],
          coverImageUrl: data.cover_image_url || "",
          authorName: data.author_name || "",
          status: data.status as BlogPostStatus,
          publishedAt: toLocalDatetime(data.published_at),
        });
      }
      initializedRef.current = true;
      setLoading(false);
    });
    return () => { active = false; };
  }, [queryId]);

  const persist = useCallback((snapshot: EditorForm): Promise<void> => {
    // A draft cannot be stored without a title (DB CHECK: 2..200 chars). Autosave
    // stays silent about it; explicit actions report it through their own guard.
    if (snapshot.title.trim().length < 2) return Promise.resolve();
    const run = async () => {
      setSaveState("saving");
      setError("");
      let slug = wasPublishedRef.current && existingSlugRef.current
        ? existingSlugRef.current
        : normalizeBlogSlug(snapshot.title);
      if (!slug) throw new Error("Başlıktan geçerli bir URL oluşturulamadı.");

      // Only touch content/content_json when the block editor actually has
      // content. Editing an existing post without adding any blocks (e.g. an
      // untouched legacy Markdown post opened in the new editor) must never
      // clobber its existing content -- see BLOG VISUAL BLOCK EDITOR V3 plan.
      const sanitized = snapshot.blocks.length ? sanitizeBlogContentJson({ version: 1, blocks: snapshot.blocks }) : null;

      if (postIdRef.current) {
        const input: Partial<BlogPostInput> = {
          locale: snapshot.locale,
          title: snapshot.title,
          slug,
          excerpt: snapshot.excerpt,
          cover_image_url: snapshot.coverImageUrl || null,
          author_name: snapshot.authorName || null,
          status: persistedStatusRef.current,
          published_at: persistedPublishedAtRef.current,
        };
        if (sanitized) {
          input.content_json = sanitized;
          input.content = deriveLegacyContentFallback(sanitized);
        }
        const result = await updateAdminBlogPost(postIdRef.current, input);
        if (!result.success) throw new Error(result.error || "Taslak kaydedilemedi.");
      } else {
        const input: BlogPostInput = {
          locale: snapshot.locale,
          title: snapshot.title,
          slug,
          excerpt: snapshot.excerpt,
          content: sanitized ? deriveLegacyContentFallback(sanitized) : "",
          content_json: sanitized,
          cover_image_url: snapshot.coverImageUrl || null,
          author_name: snapshot.authorName || null,
          status: persistedStatusRef.current,
          published_at: persistedPublishedAtRef.current,
        };
        let result = await createAdminBlogPost(input);
        if (!result.data && result.error?.includes("aynı slug")) {
          result = await createAdminBlogPost({ ...input, slug: `${slug}-${Date.now().toString(36)}` });
        }
        if (!result.data) throw new Error(result.error || "Taslak oluşturulamadı.");
        postIdRef.current = result.data.id;
        slug = result.data.slug;
        window.history.replaceState(null, "", `/admin/blog/editor/?id=${result.data.id}`);
      }
      existingSlugRef.current = slug;
      setPersistedSlug(slug);
      setSaveState("saved");
    };
    const task = saveChainRef.current.then(run).catch((cause: unknown) => {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Taslak kaydedilemedi.");
    });
    saveChainRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (!initializedRef.current || loading || form.title.trim().length < 2) return;
    const timer = window.setTimeout(() => { void persist(form); }, 900);
    return () => window.clearTimeout(timer);
  }, [form, loading, persist]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saveState === "saving") { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const setField = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function uploadCover(file: File) {
    setUploading(true);
    setError("");
    try {
      const result = await uploadAdminBlogMedia(file, "image");
      if (!result.url) throw new Error(result.error || "Dosya yüklenemedi.");
      setField("coverImageUrl", result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  /**
   * Preview renders the live editor state through the same ArticleShell the
   * public page uses. It deliberately does NOT save, publish, or open a new
   * window first: awaiting a save before window.open() loses the user-activation
   * token and gets the popup silently blocked, which is why the old "Önizle"
   * button appeared to do nothing.
   */
  function openPreview() {
    setError("");
    setPreviewOpen(true);
  }

  async function saveDraft() {
    if (form.title.trim().length < 2) {
      setError("Taslağı kaydetmek için en az 2 karakterlik bir başlık girin.");
      return;
    }
    setError("");
    await persist(form);
    await saveChainRef.current;
  }

  async function publish(schedule: boolean) {
    if (publishing) return;
    const sanitized = form.blocks.length ? sanitizeBlogContentJson({ version: 1, blocks: form.blocks }) : null;
    if (form.title.trim().length < 2 || !form.excerpt.trim() || !sanitized) {
      setError("Yayınlamak için başlık (en az 2 karakter), özet ve en az bir dolu içerik bloğu zorunludur.");
      return;
    }
    if (schedule && (!form.publishedAt || new Date(form.publishedAt).getTime() <= Date.now())) {
      setError("Planlanan yayın tarihi gelecekte olmalıdır.");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      await persist(form);
      await saveChainRef.current;
      if (!postIdRef.current) {
        setError("Yayınlamadan önce taslak kaydedilemedi.");
        return;
      }
      setSaveState("saving");
      const scheduledAt = schedule ? new Date(form.publishedAt).toISOString() : null;
      const result = await publishAdminBlogPost(postIdRef.current, scheduledAt);
      if (!result.success) {
        setSaveState("error");
        setError(result.error || "Yayın işlemi tamamlanamadı.");
        return;
      }
      wasPublishedRef.current = true;
      setEverPublished(true);
      persistedStatusRef.current = "published";
      persistedPublishedAtRef.current = result.publishedAt;
      setForm((current) => ({ ...current, status: "published", publishedAt: toLocalDatetime(result.publishedAt) }));
      setSaveState("saved");
    } finally {
      setPublishing(false);
    }
  }

  const scheduled = form.status === "published" && form.publishedAt && new Date(form.publishedAt).getTime() > renderTime;
  const previewSlug = (everPublished && persistedSlug) || normalizeBlogSlug(form.title) || "onizleme";
  const seoUrl = `oriens-academy.com/${form.locale}/blog/${previewSlug}/`;

  if (loading) return <div className="py-20 text-center"><Wave className="mx-auto h-8 w-20 text-[#819586]" /><p className="mt-3 text-xs text-muted-foreground">Editör yükleniyor…</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-16">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog/" onClick={() => { void persist(form); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-ink"><ArrowLeft className="size-4" />Blog listesine dön</Link>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${form.status === "draft" ? "border-border bg-muted" : scheduled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{form.status === "draft" ? "Taslak" : scheduled ? "Planlandı" : "Yayında"}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">{saveState === "saving" ? <><Wave className="h-3 w-7" />Kaydediliyor…</> : saveState === "saved" ? <><Check className="size-3 text-emerald-700" />Taslak kaydedildi</> : <><Save className="size-3" />Kayda hazır</>}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void saveDraft()} disabled={saveState === "saving"} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-ink transition hover:bg-muted disabled:opacity-50"><Save className="size-4" />Taslağı Kaydet</button>
          <button type="button" onClick={openPreview} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-ink transition hover:bg-muted"><Eye className="size-4" />Önizle</button>
          <button type="button" onClick={() => void publish(true)} disabled={publishing || saveState === "saving"} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 disabled:opacity-50"><CalendarClock className="size-4" />Planla</button>
          <button type="button" onClick={() => void publish(false)} disabled={publishing || saveState === "saving"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#10271B] px-4 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />{publishing ? "Gönderiliyor…" : everPublished ? "Güncelle ve Yayınla" : "Şimdi Yayınla"}</button>
        </div>
      </header>

      {error ? <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><span>{error}</span><button type="button" onClick={() => setError("")}><X className="size-4" /></button></div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-7">
          <div className="mb-6 flex gap-2">{(["tr", "en"] as const).map((locale) => <button key={locale} type="button" onClick={() => setField("locale", locale)} className={`rounded-xl border px-4 py-2 text-xs font-bold ${form.locale === locale ? "border-[#10271B] bg-[#10271B] text-white" : "bg-white text-muted-foreground"}`}>{locale === "tr" ? "Türkçe" : "English"}</button>)}</div>
          <div className="space-y-6">
            <label className="block"><span className="text-xs font-bold text-muted-foreground">Başlık</span><input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder={form.locale === "tr" ? "Yazı başlığı" : "Post title"} className="mt-2 w-full border-0 border-b border-border bg-transparent px-0 pb-3 font-heading text-3xl text-ink outline-none focus:border-primary" /></label>
            <label className="block">
              <span className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-bold text-muted-foreground">
                <span>Özet — arama sonuçlarında ve blog listesinde görünen açıklama</span>
                <span className={form.excerpt.trim().length > 160 ? "font-semibold text-amber-700" : "font-normal"}>{form.excerpt.trim().length} / 160 önerilen</span>
              </span>
              <textarea value={form.excerpt} onChange={(event) => setField("excerpt", event.target.value)} rows={3} maxLength={500} placeholder={form.locale === "tr" ? "Yazının 1-2 cümlelik özeti" : "A one or two sentence summary"} className="mt-2 w-full rounded-xl border border-input p-3 text-sm leading-relaxed outline-none focus:border-primary" />
            </label>
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">İçerik</p>
              <div className="rounded-xl border border-input p-3 sm:p-4">
                <BlockEditor
                  blocks={form.blocks}
                  onChange={(blocks) => setField("blocks", blocks)}
                  onUploadImage={(file) => uploadAdminBlogMedia(file, "image")}
                  onUploadFile={(file) => uploadAdminBlogMedia(file, "file")}
                  onError={setError}
                />
              </div>
            </div>
          </div>
        </main>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-xs font-bold text-ink">Kapak Görseli</h2>
            <label onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void uploadCover(file); }} className={`mt-3 flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed text-center ${dragging ? "border-primary bg-primary/5" : "border-input bg-muted/30"}`}>
              {form.coverImageUrl ? <Image src={form.coverImageUrl} alt="Kapak önizlemesi" width={640} height={360} unoptimized className="h-48 w-full object-cover" /> : <><UploadCloud className="size-7 text-muted-foreground" /><span className="mt-2 text-[11px] font-semibold">Dosya Seç veya sürükleyip bırak</span><span className="mt-1 text-[10px] text-muted-foreground">JPG, PNG, WEBP · en fazla 8 MB</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = ""; }} />
            </label>
            {form.coverImageUrl ? (
              <div className="mt-2 flex items-center gap-3">
                <label className="cursor-pointer text-[11px] font-semibold text-primary">Değiştir<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = ""; }} /></label>
                <button type="button" onClick={() => setField("coverImageUrl", "")} className="text-[11px] font-semibold text-red-700">Kaldır</button>
              </div>
            ) : null}
          </section>
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-xs font-bold text-ink">Arama Sonucu Önizlemesi</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Sayfa başlığı yazı başlığından, açıklama ise özetten üretilir. Ayrı bir SEO başlığı/açıklaması alanı yoktur.
            </p>
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <p className="truncate text-[11px] text-emerald-800">{seoUrl}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#1a0dab]">{form.title.trim() || "Yazı başlığı"} | Oriens Academy Blog</p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">{form.excerpt.trim() || "Özet alanına yazdığınız metin burada görünecek."}</p>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Bağlantı adresi (slug) başlıktan otomatik üretilir{everPublished ? " ve yayınlanmış bir yazıda değişmez." : "."}</p>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <label className="block text-xs font-bold text-muted-foreground">Yazar<input value={form.authorName} onChange={(event) => setField("authorName", event.target.value)} className="mt-2 h-10 w-full rounded-lg border px-3 text-xs font-normal text-ink" /></label>
            <label className="block text-xs font-bold text-muted-foreground">Yayın tarihi / saati<input type="datetime-local" value={form.publishedAt} onChange={(event) => setField("publishedAt", event.target.value)} className="mt-2 h-10 w-full rounded-lg border px-3 text-xs font-normal text-ink" /></label>
            <p className="text-[10px] leading-relaxed text-muted-foreground">Boş bırakarak “Şimdi yayınla” seçerseniz veritabanı saati kullanılır. Gelecek bir tarih seçip “Planla” ile yayınlayabilirsiniz.</p>
          </section>
        </aside>
      </div>

      {previewOpen ? (
        <BlogPreviewModal
          onClose={() => setPreviewOpen(false)}
          source={{
            locale: form.locale,
            title: form.title,
            excerpt: form.excerpt,
            blocks: form.blocks,
            coverImageUrl: form.coverImageUrl,
            authorName: form.authorName,
            publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
            slug: previewSlug,
          }}
        />
      ) : null}
    </div>
  );
}
