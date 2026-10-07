"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createAdminBlogPost,
  getAdminBlogPost,
  normalizeBlogSlug,
  parseBlogTags,
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
import { RefDatePicker, RefTimeSelect } from "@/components/admin/RefDatePicker";
import { usePageLeaveGuard } from "@/components/admin/UnsavedChangesGuard";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

// Referans blog yazısı düzenleyicisi (#view-blogyaz). Kayıt zinciri, otomatik
// taslak kaydı ve yayın/planlama mantığı mevcut güvenli akıştır.

type SaveState = "idle" | "saving" | "saved" | "error";
interface EditorForm {
  locale: BlogLocale;
  title: string;
  /** Elle yazılan bağlantı adresi; boşsa başlıktan üretilir. Yayınlanmış yazıda değişmez. */
  slug: string;
  excerpt: string;
  blocks: BlogBlock[];
  coverImageUrl: string;
  authorName: string;
  /** Virgülle ayrılmış ham metin; kayıtta parseBlogTags ile diziye çevrilir. */
  tags: string;
  status: BlogPostStatus;
  publishedAt: string;
}

const EMPTY_FORM: EditorForm = {
  locale: "tr", title: "", slug: "", excerpt: "", blocks: [], coverImageUrl: "", authorName: "Oriens Academy", tags: "", status: "draft", publishedAt: "",
};

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const pad2 = (value: number) => String(value).padStart(2, "0");
const formKey = (form: EditorForm) => JSON.stringify(form);

/** Kelime sayımı için blokların görünen metinleri (referans be-stats). */
const TEXT_KEYS = new Set(["text", "title", "description", "label", "caption", "buttonLabel"]);
function collectBlockText(value: unknown, out: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectBlockText(item, out));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (TEXT_KEYS.has(key)) out.push(child);
    } else {
      collectBlockText(child, out);
    }
  }
}

function StatIcon({ children }: { children: ReactNode }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function BlogEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(Boolean(queryId));
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  /** Son kalıcı kaydedilen form; ekrandaki form bundan farklıysa "kaydedilmemiş". */
  const [savedKey, setSavedKey] = useState(() => formKey(EMPTY_FORM));
  const [savedAt, setSavedAt] = useState("");
  const [invalid, setInvalid] = useState<{ title?: boolean; date?: boolean }>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Render-safe mirrors of existingSlugRef / wasPublishedRef. The refs stay the
  // source of truth inside the save chain (they must not trigger re-renders
  // mid-save); these are what the UI is allowed to read.
  const [persistedSlug, setPersistedSlug] = useState("");
  const [everPublished, setEverPublished] = useState(false);
  const [hasRecord, setHasRecord] = useState(Boolean(queryId));
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  /**
   * Whether the persisted publish date is still in the future. Derived when the
   * post loads and again when it is published -- never from a timestamp captured
   * at mount, which made every just-published post read "Planlandı" because its
   * publish time is always later than the moment the editor was opened.
   */
  const [scheduled, setScheduled] = useState(false);
  const postIdRef = useRef<string | null>(queryId);
  const existingSlugRef = useRef("");
  const wasPublishedRef = useRef(false);
  const persistedStatusRef = useRef<BlogPostStatus>("draft");
  const persistedPublishedAtRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  // Referans: doğrulama ve kayıt hataları listToast ile bildirilir.
  const setError = useCallback((message: string) => {
    if (message) toast.error(message);
  }, []);

  useEffect(() => {
    let active = true;
    if (!queryId) {
      initializedRef.current = true;
      return;
    }
    void getAdminBlogPost(queryId).then(({ data, error: fetchError }) => {
      if (!active) return;
      if (fetchError || !data) {
        setLoadError(fetchError || "Yazı bulunamadı.");
      } else {
        existingSlugRef.current = data.slug;
        wasPublishedRef.current = data.status === "published";
        setPersistedSlug(data.slug);
        setEverPublished(data.status === "published");
        persistedStatusRef.current = data.status as BlogPostStatus;
        persistedPublishedAtRef.current = data.published_at;
        setScheduled(
          data.status === "published" && Boolean(data.published_at) && new Date(data.published_at as string).getTime() > Date.now()
        );
        const sanitized = sanitizeBlogContentJson(data.content_json);
        const loaded: EditorForm = {
          locale: data.locale as BlogLocale,
          title: data.title || "",
          slug: data.slug || "",
          excerpt: data.excerpt?.trim() || "",
          blocks: sanitized ? sanitized.blocks : [],
          coverImageUrl: data.cover_image_url || "",
          authorName: data.author_name || "",
          tags: (data.tags ?? []).join(", "),
          status: data.status as BlogPostStatus,
          publishedAt: toLocalDatetime(data.published_at),
        };
        setForm(loaded);
        setSavedKey(formKey(loaded));
        setSlugTouched(true);
        setSavedAt("Kayıtlı");
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
      let slug = wasPublishedRef.current && existingSlugRef.current
        ? existingSlugRef.current
        : normalizeBlogSlug(snapshot.slug) || normalizeBlogSlug(snapshot.title);
      if (!slug) throw new Error("Başlıktan geçerli bir URL oluşturulamadı.");

      // Only touch content/content_json when the block editor actually has
      // content. Editing an existing post without adding any blocks (e.g. an
      // untouched legacy Markdown post opened in the new editor) must never
      // clobber its existing content -- see BLOG VISUAL BLOCK EDITOR V3 plan.
      const sanitized = snapshot.blocks.length ? sanitizeBlogContentJson({ version: 1, blocks: snapshot.blocks }) : null;
      // A block that fails sanitization is not stored. It stays on screen and in
      // the preview, so without this the author only finds out it was dropped
      // after publishing. Say so instead of losing their work quietly.
      const droppedBlocks = snapshot.blocks.length - (sanitized?.blocks.length ?? 0);

      if (postIdRef.current) {
        const input: Partial<BlogPostInput> = {
          locale: snapshot.locale,
          title: snapshot.title,
          slug,
          excerpt: snapshot.excerpt,
          cover_image_url: snapshot.coverImageUrl || null,
          author_name: snapshot.authorName || null,
          tags: parseBlogTags(snapshot.tags),
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
          tags: parseBlogTags(snapshot.tags),
          status: persistedStatusRef.current,
          published_at: persistedPublishedAtRef.current,
        };
        let result = await createAdminBlogPost(input);
        if (!result.data && result.error?.includes("aynı slug")) {
          result = await createAdminBlogPost({ ...input, slug: `${slug}-${Date.now().toString(36)}` });
        }
        if (!result.data) throw new Error(result.error || "Taslak oluşturulamadı.");
        postIdRef.current = result.data.id;
        setHasRecord(true);
        slug = result.data.slug;
        window.history.replaceState(null, "", `/admin/blog/editor/?id=${result.data.id}`);
      }
      existingSlugRef.current = slug;
      setPersistedSlug(slug);
      setSaveState("saved");
      setSavedKey(formKey(snapshot));
      const at = new Date();
      setSavedAt(`Kaydedildi · ${pad2(at.getHours())}:${pad2(at.getMinutes())}`);
      if (droppedBlocks > 0) {
        setError(
          `${droppedBlocks} blok kaydedilemedi ve yayında görünmeyecek. Görsel/dosya bloklarında yükleme tamamlanmamış olabilir; bloğu silip yeniden ekleyin.`
        );
      }
    };
    const task = saveChainRef.current.then(run).catch((cause: unknown) => {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Taslak kaydedilemedi.");
    });
    saveChainRef.current = task;
    return task;
  }, [setError]);

  useEffect(() => {
    if (!initializedRef.current || loading || form.title.trim().length < 2) return;
    if (formKey(form) === savedKey) return;
    const timer = window.setTimeout(() => { void persist(form); }, 900);
    return () => window.clearTimeout(timer);
  }, [form, loading, persist, savedKey]);

  const dirty = !loading && !loadError && (formKey(form) !== savedKey || saveState === "saving");
  usePageLeaveGuard(dirty, {
    title: "Kaydedilmemiş değişiklikler",
    text: "Yazıda kaydedilmemiş değişiklikler var. Sayfadan çıkarsanız bu değişiklikler kaybolacak.",
    ok: "Kaydetmeden çık",
  });

  function updateField<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    if (key === "title" && invalid.title) setInvalid((current) => ({ ...current, title: false }));
    if (key === "publishedAt" && invalid.date) setInvalid((current) => ({ ...current, date: false }));
    setForm((current) => ({ ...current, [key]: value }));
  }
  // Referans be-tarih + be-saat/be-dk: tarih seçilmeden saat 09:00 varsayılır.
  const [pendingTime, setPendingTime] = useState({ hour: "09", minute: "00" });
  const publishDay = form.publishedAt.slice(0, 10);
  const publishHour = form.publishedAt.slice(11, 13) || pendingTime.hour;
  const publishMinute = form.publishedAt.slice(14, 16) || pendingTime.minute;

  async function uploadCover(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setError("Görsel 8 MB’tan büyük olamaz");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadAdminBlogMedia(file, "image");
      if (!result.url) throw new Error(result.error || "Dosya yüklenemedi.");
      updateField("coverImageUrl", result.url);
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
    setPreviewOpen(true);
  }

  async function saveDraft() {
    if (form.title.trim().length < 2) {
      setInvalid({ title: true });
      setError("Taslak için en az 2 karakterlik bir başlık gerekli");
      return;
    }
    await persist(form);
    await saveChainRef.current;
    if (postIdRef.current) toast.success("Taslak kaydedildi");
  }

  async function publish(schedule: boolean) {
    if (publishing) return;
    const sanitized = form.blocks.length ? sanitizeBlogContentJson({ version: 1, blocks: form.blocks }) : null;
    // Name the one thing that is missing; a combined sentence makes the author
    // re-check fields that were already fine.
    const missing =
      form.title.trim().length < 2
        ? "Yayınlamak için en az 2 karakterlik bir başlık girin."
        : !form.excerpt.trim()
        ? "Yayınlamak için özet alanını doldurun."
        : !sanitized
        ? "Yayınlamak için en az bir içerik bloğu ekleyin."
        : "";
    if (missing) {
      setInvalid({ title: form.title.trim().length < 2 });
      setError(missing);
      return;
    }
    if (schedule && (!form.publishedAt || new Date(form.publishedAt).getTime() <= Date.now())) {
      setInvalid({ date: true });
      setError("Planlamak için gelecek bir tarih ve saat seçin");
      return;
    }
    setPublishing(true);
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
      const isScheduled = Boolean(result.publishedAt && new Date(result.publishedAt).getTime() > Date.now());
      setScheduled(isScheduled);
      const next: EditorForm = { ...form, status: "published", publishedAt: toLocalDatetime(result.publishedAt) };
      setForm(next);
      setSavedKey(formKey(next));
      setSaveState("saved");
      if (isScheduled && result.publishedAt) {
        const at = new Date(result.publishedAt);
        toast.success(`Yazı ${pad2(at.getDate())} ${TR_MONTHS[at.getMonth()]} ${pad2(at.getHours())}:${pad2(at.getMinutes())} için planlandı`);
      } else {
        toast.success("Yazı yayınlandı");
      }
      router.push("/admin/blog/");
    } finally {
      setPublishing(false);
    }
  }

  const autoSlug = normalizeBlogSlug(form.title);
  const slugValue = everPublished ? persistedSlug : slugTouched ? form.slug : autoSlug;
  const previewSlug = (everPublished && persistedSlug) || normalizeBlogSlug(slugValue) || autoSlug || "onizleme";
  const en = form.locale === "en";
  const excerptLength = form.excerpt.length;
  const trimmedExcerpt = form.excerpt.trim();
  const words: string[] = [];
  collectBlockText(form.blocks, words);
  const wordCount = (words.join(" ").trim().match(/\S+/g) || []).length;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  const excerptStatus = !trimmedExcerpt.length ? <span className="warn">Özet boş</span>
    : trimmedExcerpt.length < 70 ? <span className="warn">Özet kısa ({trimmedExcerpt.length})</span>
    : trimmedExcerpt.length <= 160 ? <span className="ok">Özet uzunluğu iyi</span>
    : <span className="warn">Özet uzun</span>;
  const statusTag = !hasRecord ? <span className="fx-tag grey">Yeni taslak</span>
    : form.status === "published" ? (scheduled ? <span className="fx-tag star">Planlandı</span> : <span className="fx-tag ok">Yayında</span>)
    : <span className="fx-tag grey">Taslak</span>;
  const check = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

  if (loading || loadError) {
    return (
      <div id="view-blogyaz" className={`pgv ${pages.root}`}>
        <div className="page"><div className="wrap be-wrap">
          <section className="card">
            <div className="fx-empty">
              <b>{loading ? "Editör yükleniyor…" : "Yazı açılamadı"}</b>
              {loading ? null : <span>{loadError}</span>}
              {loading ? null : <Link className="fx-btn" href="/admin/blog/">Blog listesine dön</Link>}
            </div>
          </section>
        </div></div>
      </div>
    );
  }

  return (
    <div id="view-blogyaz" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap be-wrap">
        <div className="be-top">
          <div className="be-top-l">
            <Link className="be-back" href="/admin/blog/">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Blog listesine dön
            </Link>
            {statusTag}
            {saveState === "saving" ? (
              <span className="be-state">{check}Kaydediliyor…</span>
            ) : saveState === "error" ? (
              <span className="be-state dirty"><i className="be-dot" />Kaydedilemedi</span>
            ) : dirty ? (
              <span className="be-state dirty"><i className="be-dot" />Kaydedilmemiş değişiklikler</span>
            ) : (
              <span className="be-state">{check}{savedAt || "Kayda hazır"}</span>
            )}
          </div>
          <div className="be-top-r">
            <button className="fx-btn" type="button" onClick={() => void saveDraft()} disabled={saveState === "saving"}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
              Taslağı Kaydet
            </button>
            <button className="fx-btn" type="button" onClick={openPreview}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
              Önizle
            </button>
            <button className="fx-btn be-plan" type="button" onClick={() => void publish(true)} disabled={publishing || saveState === "saving"}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v3l2 1" /></svg>
              Planla
            </button>
            <button className="fx-btn primary" type="button" onClick={() => void publish(false)} disabled={publishing || saveState === "saving"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
              {publishing ? "Yayınlanıyor…" : "Şimdi Yayınla"}
            </button>
          </div>
        </div>

        <div className="be-grid">
          <section className="card be-main">
            <div className="fx-lang" role="tablist" aria-label="Yazı dili">
              {(["tr", "en"] as const).map((locale) => (
                <button key={locale} type="button" role="tab" aria-selected={form.locale === locale} onClick={() => updateField("locale", locale)}>
                  {locale === "tr" ? "Türkçe" : "English"}
                </button>
              ))}
            </div>
            <div className="be-pane">
              <label className="be-lab" htmlFor="be-baslik">{en ? "Title" : "Başlık"} <span className="m-req">*</span></label>
              <input id="be-baslik" className={`be-title${invalid.title ? " be-err" : ""}`} placeholder={en ? "Post title" : "Yazı başlığı"} autoComplete="off" value={form.title} onChange={(event) => updateField("title", event.target.value)} />
              <div className="be-row">
                <label className="be-lab" htmlFor="be-ozet">{en ? "Summary" : "Özet"} <span className="be-sub">{en ? "— shown in search results and the blog list" : "— arama sonuçlarında ve blog listesinde görünen açıklama"}</span></label>
                <span className={`be-count${excerptLength > 160 ? " over" : ""}`}>{excerptLength} / 160</span>
              </div>
              <textarea id="be-ozet" className="m-textarea be-ozet" rows={3} maxLength={500} placeholder={en ? "A 1–2 sentence summary" : "Yazının 1–2 cümlelik özeti"} value={form.excerpt} onChange={(event) => updateField("excerpt", event.target.value)} />
              <span className="be-lab">{en ? "Content" : "İçerik"} <span className="m-req">*</span></span>
              <BlockEditor
                blocks={form.blocks}
                onChange={(blocks) => updateField("blocks", blocks)}
                onUploadImage={(file) => uploadAdminBlogMedia(file, "image")}
                onUploadFile={(file) => uploadAdminBlogMedia(file, "file")}
                onError={setError}
              />
            </div>
            <div className="be-stats" aria-live="polite">
              <span><StatIcon><path d="M4 6h16M4 12h16M4 18h10" /></StatIcon><b>{wordCount}</b> kelime</span>
              <span><StatIcon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></StatIcon><b>~{readMinutes}</b> dk okuma</span>
              <span><StatIcon><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></StatIcon><b>{form.blocks.length}</b> bölüm</span>
              {excerptStatus}
              <span style={{ marginLeft: "auto" }}>{en ? "English" : "Türkçe"}</span>
            </div>
          </section>

          <aside className="be-side">
            <section className="card be-card">
              <h3>Kapak görseli</h3>
              <label
                className={`be-cover${form.coverImageUrl ? " has" : ""}${dragging ? " over" : ""}`}
                style={form.coverImageUrl ? { backgroundImage: `url("${form.coverImageUrl}")` } : undefined}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void uploadCover(file); }}
              >
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden id="be-kapak" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.currentTarget.value = ""; }} />
                <span className="be-cover-in">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></svg>
                  <b>{uploading ? "Yükleniyor…" : form.coverImageUrl ? "Görseli değiştir" : "Dosya seçin veya sürükleyip bırakın"}</b>
                  <small>JPG, PNG, WEBP · en fazla 8 MB · önerilen 1200×630</small>
                </span>
              </label>
              <button type="button" className="fx-link be-cover-rm" hidden={!form.coverImageUrl} onClick={() => updateField("coverImageUrl", "")}>Görseli kaldır</button>
            </section>

            <section className="card be-card">
              <h3>Arama sonucu önizlemesi</h3>
              <p className="be-hint">Sayfa başlığı yazı başlığından, açıklama özetten oluşur.</p>
              <div className="be-serp">
                <span className="u">oriens-academy.com/{form.locale}/blog/{normalizeBlogSlug(slugValue) || "yazi-adresi"}</span>
                <b>{form.title.trim() || (en ? "Post title" : "Yazı başlığı")} | Oriens Academy Blog</b>
                <span className="d">{trimmedExcerpt ? (trimmedExcerpt.length > 160 ? `${trimmedExcerpt.slice(0, 157)}…` : trimmedExcerpt) : en ? "Your summary will appear here." : "Özet alanına yazdığınız metin burada görünür."}</span>
              </div>
              <div className="m-field">
                <label htmlFor="be-slug" className="m-lab">Bağlantı adresi</label>
                <div className="fx-slug">
                  <span>/blog/</span>
                  <input
                    id="be-slug"
                    className="m-input fx-mono"
                    placeholder="baslıktan-otomatik"
                    value={slugValue}
                    readOnly={everPublished}
                    title={everPublished ? "Yayınlanmış yazının bağlantı adresi değişmez." : undefined}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setSlugTouched(true);
                      updateField("slug", normalizeBlogSlug(raw) + (raw.endsWith("-") ? "-" : ""));
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="card be-card">
              <h3>Yayın</h3>
              <div className="m-field">
                <label htmlFor="be-yazar" className="m-lab">Yazar</label>
                <input id="be-yazar" className="m-input" value={form.authorName} onChange={(event) => updateField("authorName", event.target.value)} />
              </div>
              <div className="m-field">
                <label htmlFor="be-etiket" className="m-lab">Etiketler <span className="m-opt">(virgülle)</span></label>
                <input id="be-etiket" className="m-input" placeholder="Örn. SAT, Matematik" maxLength={400} value={form.tags} onChange={(event) => updateField("tags", event.target.value)} />
              </div>
              <div className="m-field">
                <label htmlFor="be-tarih" className="m-lab">Yayın tarihi ve saati</label>
                <div className="be-when" style={invalid.date ? { borderRadius: 12, boxShadow: "0 0 0 3px rgba(192,83,63,.12)" } : undefined}>
                  <RefDatePicker id="be-tarih" value={publishDay} onChange={(day) => updateField("publishedAt", `${day}T${publishHour}:${publishMinute}`)} />
                  <RefTimeSelect hour={publishHour} minute={publishMinute} onChange={(hour, minute) => { if (publishDay) updateField("publishedAt", `${publishDay}T${hour}:${minute}`); else setPendingTime({ hour, minute }); }} />
                </div>
              </div>
              <p className="be-hint">“Şimdi Yayınla” hemen yayınlar. Gelecek bir tarih ve saat seçip “Planla” derseniz yazı o anda otomatik yayına girer.</p>
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
      </div></div>
    </div>
  );
}
