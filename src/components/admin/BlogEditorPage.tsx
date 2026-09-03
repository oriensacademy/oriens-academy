"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Check, Eye, FileText, ImagePlus, Save, Send, UploadCloud, X } from "lucide-react";
import { renderBlogMarkdown } from "@/lib/blog/markdown";
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
import { Wave } from "@/components/ui/wave";

type SaveState = "idle" | "saving" | "saved" | "error";
interface EditorForm {
  locale: BlogLocale;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  authorName: string;
  status: BlogPostStatus;
  publishedAt: string;
}

const EMPTY_FORM: EditorForm = {
  locale: "tr", title: "", excerpt: "", content: "", coverImageUrl: "", authorName: "", status: "draft", publishedAt: "",
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
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "image" | "file" | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [dragging, setDragging] = useState(false);
  const [renderTime] = useState(() => Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
        persistedStatusRef.current = data.status as BlogPostStatus;
        persistedPublishedAtRef.current = data.published_at;
        setForm({
          locale: data.locale as BlogLocale,
          title: data.title || "",
          excerpt: data.excerpt?.trim() || "",
          content: data.content?.trim() || "",
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
    if (snapshot.title.trim().length < 2) return Promise.resolve();
    const run = async () => {
      setSaveState("saving");
      setError("");
      let slug = wasPublishedRef.current && existingSlugRef.current
        ? existingSlugRef.current
        : normalizeBlogSlug(snapshot.title);
      if (!slug) throw new Error("Başlıktan geçerli bir URL oluşturulamadı.");
      const input: BlogPostInput = {
        locale: snapshot.locale,
        title: snapshot.title,
        slug,
        excerpt: snapshot.excerpt,
        content: snapshot.content,
        cover_image_url: snapshot.coverImageUrl || null,
        author_name: snapshot.authorName || null,
        status: persistedStatusRef.current,
        published_at: persistedPublishedAtRef.current,
      };
      if (postIdRef.current) {
        const result = await updateAdminBlogPost(postIdRef.current, input);
        if (!result.success) throw new Error(result.error || "Taslak kaydedilemedi.");
      } else {
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

  async function upload(file: File, target: "cover" | "image" | "file") {
    setUploading(target);
    setError("");
    try {
      const result = await uploadAdminBlogMedia(file, target === "file" ? "file" : "image");
      if (!result.url) throw new Error(result.error || "Dosya yüklenemedi.");
      if (target === "cover") setField("coverImageUrl", result.url);
      else {
        const label = target === "image" ? (imageAlt.trim() || file.name.replace(/\.[^.]+$/, "")) : file.name;
        const markdown = target === "image"
          ? `\n![${label}](${result.url})${imageCaption.trim() ? ` "${imageCaption.trim().replace(/"/g, "'")}"` : ""}\n`
          : `\n[${label}](${result.url})\n`;
        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? form.content.length;
        const end = textarea?.selectionEnd ?? start;
        setField("content", `${form.content.slice(0, start)}${markdown}${form.content.slice(end)}`);
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(null);
    }
  }

  async function publish(schedule: boolean) {
    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      setError("Yayınlamak için başlık, özet ve içerik zorunludur.");
      return;
    }
    if (schedule && (!form.publishedAt || new Date(form.publishedAt).getTime() <= Date.now())) {
      setError("Planlanan yayın tarihi gelecekte olmalıdır.");
      return;
    }
    await persist(form);
    await saveChainRef.current;
    if (!postIdRef.current) return;
    setSaveState("saving");
    const scheduledAt = schedule ? new Date(form.publishedAt).toISOString() : null;
    const result = await publishAdminBlogPost(postIdRef.current, scheduledAt);
    if (!result.success) {
      setSaveState("error");
      setError(result.error || "Yayın işlemi tamamlanamadı.");
      return;
    }
    wasPublishedRef.current = true;
    persistedStatusRef.current = "published";
    persistedPublishedAtRef.current = result.publishedAt;
    setForm((current) => ({ ...current, status: "published", publishedAt: toLocalDatetime(result.publishedAt) }));
    setSaveState("saved");
  }

  const scheduled = form.status === "published" && form.publishedAt && new Date(form.publishedAt).getTime() > renderTime;

  if (loading) return <div className="py-20 text-center"><Wave className="mx-auto h-8 w-20 text-[#819586]" /><p className="mt-3 text-xs text-muted-foreground">Editör yükleniyor…</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-16">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog/" onClick={() => { void persist(form); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-ink"><ArrowLeft className="size-4" />Blog listesine dön</Link>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${form.status === "draft" ? "border-border bg-muted" : scheduled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{form.status === "draft" ? "Taslak" : scheduled ? "Planlandı" : "Yayında"}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">{saveState === "saving" ? <><Wave className="h-3 w-7" />Kaydediliyor…</> : saveState === "saved" ? <><Check className="size-3 text-emerald-700" />Taslak kaydedildi</> : <><Save className="size-3" />Kayda hazır</>}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-semibold"><Eye className="size-4" />{preview ? "Editöre dön" : "Önizle"}</button>
          <button type="button" onClick={() => void publish(true)} disabled={saveState === "saving"} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 disabled:opacity-50"><CalendarClock className="size-4" />Planla</button>
          <button type="button" onClick={() => void publish(false)} disabled={saveState === "saving"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#10271B] px-4 text-xs font-semibold text-white disabled:opacity-50"><Send className="size-4" />Şimdi yayınla</button>
        </div>
      </header>

      {error ? <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><span>{error}</span><button type="button" onClick={() => setError("")}><X className="size-4" /></button></div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-7">
          <div className="mb-6 flex gap-2">{(["tr", "en"] as const).map((locale) => <button key={locale} type="button" onClick={() => setField("locale", locale)} className={`rounded-xl border px-4 py-2 text-xs font-bold ${form.locale === locale ? "border-[#10271B] bg-[#10271B] text-white" : "bg-white text-muted-foreground"}`}>{locale === "tr" ? "Türkçe" : "English"}</button>)}</div>
          {preview ? (
            <article className="mx-auto max-w-3xl py-8">
              {form.coverImageUrl ? <Image src={form.coverImageUrl} alt="" width={1400} height={900} unoptimized className="mb-8 max-h-[28rem] w-full rounded-2xl object-cover" /> : null}
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{form.locale}</p>
              <h1 className="mt-3 font-heading text-4xl text-ink">{form.title || "Başlıksız yazı"}</h1>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{form.excerpt}</p>
              <div className="mt-9">{renderBlogMarkdown(form.content)}</div>
            </article>
          ) : (
            <div className="space-y-6">
              <label className="block"><span className="text-xs font-bold text-muted-foreground">Başlık</span><input value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder={form.locale === "tr" ? "Yazı başlığı" : "Post title"} className="mt-2 w-full border-0 border-b border-border bg-transparent px-0 pb-3 font-heading text-3xl text-ink outline-none focus:border-primary" /></label>
              <label className="block"><span className="text-xs font-bold text-muted-foreground">Özet</span><textarea value={form.excerpt} onChange={(event) => setField("excerpt", event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-input p-3 text-sm leading-relaxed outline-none focus:border-primary" /></label>
              <div>
                <div className="mb-2 flex flex-wrap items-end gap-2">
                  <div className="mr-auto"><p className="text-xs font-bold text-muted-foreground">İçerik (Markdown)</p><p className="mt-1 text-[10px] text-muted-foreground">Görsel ve PDF seçildiği anda imleç konumuna eklenir.</p></div>
                  <input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} placeholder="Görsel alt metni" className="h-9 rounded-lg border px-2 text-[11px]" />
                  <input value={imageCaption} onChange={(event) => setImageCaption(event.target.value)} placeholder="Açıklama (opsiyonel)" className="h-9 rounded-lg border px-2 text-[11px]" />
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-[11px] font-semibold"><ImagePlus className="size-3.5" />{uploading === "image" ? "Yükleniyor…" : "Görsel Ekle"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "image"); event.currentTarget.value = ""; }} /></label>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-[11px] font-semibold"><FileText className="size-3.5" />{uploading === "file" ? "Yükleniyor…" : "PDF/Dosya Ekle"}<input type="file" accept="application/pdf" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "file"); event.currentTarget.value = ""; }} /></label>
                </div>
                <textarea ref={textareaRef} value={form.content} onChange={(event) => setField("content", event.target.value)} rows={24} placeholder="# Başlık\n\nYazınıza başlayın…" className="w-full resize-y rounded-xl border border-input p-4 font-mono text-sm leading-7 outline-none focus:border-primary" />
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-xs font-bold text-ink">Kapak Görseli</h2>
            <label onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void upload(file, "cover"); }} className={`mt-3 flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed text-center ${dragging ? "border-primary bg-primary/5" : "border-input bg-muted/30"}`}>
              {form.coverImageUrl ? <Image src={form.coverImageUrl} alt="Kapak önizlemesi" width={480} height={240} unoptimized className="h-36 w-full object-cover" /> : <><UploadCloud className="size-6 text-muted-foreground" /><span className="mt-2 text-[11px] font-semibold">Dosya Seç veya sürükleyip bırak</span><span className="mt-1 text-[10px] text-muted-foreground">JPG, PNG, WEBP · en fazla 8 MB</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "cover"); event.currentTarget.value = ""; }} />
            </label>
            {form.coverImageUrl ? <button type="button" onClick={() => setField("coverImageUrl", "")} className="mt-2 text-[11px] font-semibold text-red-700">Görseli kaldır/değiştir</button> : null}
          </section>
          <section className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <label className="block text-xs font-bold text-muted-foreground">Yazar<input value={form.authorName} onChange={(event) => setField("authorName", event.target.value)} className="mt-2 h-10 w-full rounded-lg border px-3 text-xs font-normal text-ink" /></label>
            <label className="block text-xs font-bold text-muted-foreground">Yayın tarihi / saati<input type="datetime-local" value={form.publishedAt} onChange={(event) => setField("publishedAt", event.target.value)} className="mt-2 h-10 w-full rounded-lg border px-3 text-xs font-normal text-ink" /></label>
            <p className="text-[10px] leading-relaxed text-muted-foreground">Boş bırakarak “Şimdi yayınla” seçerseniz veritabanı saati kullanılır. Gelecek bir tarih seçip “Planla” ile yayınlayabilirsiniz.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
