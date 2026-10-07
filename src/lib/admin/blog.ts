import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";
import type { BlogContentJson } from "@/lib/blog/blockSchema";
import { reportAdminFailure } from "@/lib/admin/audit";

function reportBlogFailure(operation: string, error: unknown, entityId?: string) {
  const record = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
  void reportAdminFailure({
    action: "blog.operation_failed", category: "blog", operation, error,
    entityType: "blog_post", entityId, route: "/admin/blog",
  });
  if (record.code === "42501" || /permission denied|row-level security/i.test(record.message || "")) {
    void reportAdminFailure({
      action: "database.permission_denied", category: "database", operation, error,
      entityType: "blog_post", entityId, route: "/admin/blog",
    });
  }
}

export type BlogPostRow = Tables<"blog_posts">;
export type BlogPostStatus = "draft" | "published" | "archived";
export type BlogLocale = "tr" | "en";

/**
 * A few seconds in the past, not the exact instant. The public RLS policy
 * gates visibility on `published_at <= now()` evaluated by Postgres; if this
 * client's clock is even slightly ahead of the DB server's, a stamp of
 * "right now" can miss that check and the post stays invisible until the
 * DB's own clock catches up. Backdating by a small margin makes "publish"
 * take effect immediately regardless of client/server clock drift, with no
 * visible effect since post dates render to the day, not the second.
 */
function publishNowStamp(): string {
  return new Date(Date.now() - 5000).toISOString();
}

export interface BlogPostInput {
  locale: BlogLocale;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  content_json?: BlogContentJson | null;
  cover_image_url?: string | null;
  author_name?: string | null;
  /** Referans "Etiketler (virgülle)"; parseBlogTags ile normalize edilir. */
  tags?: string[];
  status: BlogPostStatus;
  published_at?: string | null;
}

export const BLOG_TAG_LIMIT = 12;
/** blog_posts_tags_limits: virgülle birleşik uzunluk. */
const BLOG_TAGS_MAX_CHARS = 400;

/**
 * "SAT, Matematik" gibi virgülle yazılan etiketleri kırpar, boşları ve
 * büyük/küçük harf duyarsız tekrarları atar; DB sınırına (12 etiket, etiket
 * başına 40 karakter, birleşik 400 karakter) göre keser.
 */
export function parseBlogTags(raw: string | string[] | null | undefined): string[] {
  const items = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  const seen = new Set<string>();
  const tags: string[] = [];
  let length = 0;
  for (const item of items) {
    const tag = item.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = tag.toLocaleLowerCase("tr");
    if (!tag || seen.has(key)) continue;
    const nextLength = length + (tags.length ? 1 : 0) + tag.length;
    if (nextLength > BLOG_TAGS_MAX_CHARS) break;
    seen.add(key);
    length = nextLength;
    tags.push(tag);
    if (tags.length === BLOG_TAG_LIMIT) break;
  }
  return tags;
}

/**
 * Normalizes a raw title/slug into the lowercase-hyphen format enforced by
 * the DB's slug CHECK constraint. Strips anything that isn't a-z/0-9/space,
 * collapses whitespace to single hyphens, trims leading/trailing hyphens.
 */
export function normalizeBlogSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Fetches published blog posts for a locale directly from Supabase at
 * runtime (same "no rebuild required" pattern as getPublicPricingPackages).
 */
export async function getPublicBlogPosts(locale: BlogLocale): Promise<BlogPostRow[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (!supabaseUrl || !publishableKey) return [];

    const query = new URLSearchParams({
      select: "id,slug,locale,title,excerpt,content,content_json,cover_image_url,author_name,status,published_at,created_at,updated_at",
      locale: `eq.${locale}`,
      status: "eq.published",
      order: "published_at.desc",
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/blog_posts?${query}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as BlogPostRow[];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Fetches a single published post by (locale, slug) directly from Supabase
 * at runtime. Used by the static detail-page shell.
 */
export async function getPublicBlogPost(locale: BlogLocale, slug: string): Promise<BlogPostRow | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (!supabaseUrl || !publishableKey || !slug) return null;

    const query = new URLSearchParams({
      select: "id,slug,locale,title,excerpt,content,content_json,cover_image_url,author_name,status,published_at,created_at,updated_at",
      locale: `eq.${locale}`,
      slug: `eq.${slug}`,
      status: "eq.published",
      limit: "1",
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/blog_posts?${query}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as BlogPostRow[];
    return data?.[0] || null;
  } catch {
    return null;
  }
}

/** Lists active or archived posts for admin management. */
export async function listAdminBlogPosts(
  options: { archived?: boolean } = {}
): Promise<{ data: BlogPostRow[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    let query = supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    query = options.archived ? query.eq("status", "archived") : query.neq("status", "archived");
    const { data, error } = await query;
    if (error) { reportBlogFailure("list", error); return { data: [], error: error.message }; }
    return { data: data || [], error: null };
  } catch (error) {
    reportBlogFailure("list", error);
    return { data: [], error: "Blog yazıları yüklenirken bir hata oluştu." };
  }
}

export async function getAdminBlogPost(id: string): Promise<{ data: BlogPostRow | null; error: string | null }> {
  try {
    const { data, error } = await getSupabaseClient().from("blog_posts").select("*").eq("id", id).single();
    if (error) reportBlogFailure("get", error, id);
    return error ? { data: null, error: error.message } : { data, error: null };
  } catch (error) {
    reportBlogFailure("get", error, id);
    return { data: null, error: "Blog yazısı yüklenirken bir hata oluştu." };
  }
}

export async function createAdminBlogPost(
  input: BlogPostInput
): Promise<{ data: BlogPostRow | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const slug = normalizeBlogSlug(input.slug || input.title);
  if (!slug) return { data: null, error: "Geçerli bir slug gereklidir." };

  try {
    const { data: userData } = await supabase.auth.getUser();
    const insertPayload: TablesInsert<"blog_posts"> = {
      locale: input.locale,
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt.trim() || (input.status === "draft" ? " " : ""),
      content: input.content || (input.status === "draft" ? " " : ""),
      content_json: (input.content_json ?? null) as TablesInsert<"blog_posts">["content_json"],
      cover_image_url: input.cover_image_url?.trim() || null,
      author_name: input.author_name?.trim() || null,
      tags: parseBlogTags(input.tags),
      status: input.status,
      published_at: input.status === "published" ? input.published_at || publishNowStamp() : input.published_at || null,
    };

    const { data, error } = await supabase.from("blog_posts").insert(insertPayload).select().single();
    if (error) {
      reportBlogFailure("create", error);
      if (error.code === "23505") return { data: null, error: "Bu dilde aynı slug'a sahip bir yazı zaten mevcut." };
      return { data: null, error: error.message };
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.blog.post_created",
      entity_type: "blog_post",
      entity_id: data.id,
      metadata: { locale: data.locale, slug: data.slug, status: data.status },
    });

    return { data, error: null };
  } catch (error) {
    reportBlogFailure("create", error);
    return { data: null, error: "Yazı oluşturulurken bir hata oluştu." };
  }
}

/** The publish RPC answers with machine codes; the editor shows people sentences. */
const PUBLISH_ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Yazı bulunamadı. Sayfayı yenileyip tekrar deneyin.",
  TITLE_REQUIRED: "Yayınlamak için en az 2 karakterlik bir başlık girin.",
  EXCERPT_REQUIRED: "Yayınlamak için özet alanını doldurun.",
  CONTENT_REQUIRED: "Yayınlamak için en az bir içerik bloğu ekleyin.",
  ADMIN_REQUIRED: "Bu işlem için yönetici yetkisi gerekiyor.",
};

export async function publishAdminBlogPost(
  id: string,
  scheduledAt: string | null
): Promise<{ success: boolean; publishedAt: string | null; error: string | null }> {
  try {
    // The RPC uses Postgres now() when scheduledAt is null, avoiding client-clock races.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getSupabaseClient() as any).rpc("admin_publish_blog_post", {
      p_post_id: id,
      p_scheduled_at: scheduledAt,
    });
    if (error) { reportBlogFailure("publish", error, id); return { success: false, publishedAt: null, error: error.message }; }
    const result = data as { success?: boolean; published_at?: string; error_code?: string } | null;
    if (result?.success) return { success: true, publishedAt: result.published_at || null, error: null };
    const code = result?.error_code || "";
    return { success: false, publishedAt: null, error: PUBLISH_ERROR_MESSAGES[code] || "Yayın işlemi tamamlanamadı." };
  } catch (error) {
    reportBlogFailure("publish", error, id);
    return { success: false, publishedAt: null, error: "Yayın işlemi tamamlanamadı." };
  }
}

const BLOG_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BLOG_FILE_TYPES = new Set(["application/pdf"]);

export async function uploadAdminBlogMedia(
  file: File,
  kind: "image" | "file"
): Promise<{ url: string | null; size: number; error: string | null }> {
  const allowed = kind === "image" ? BLOG_IMAGE_TYPES : BLOG_FILE_TYPES;
  const maxBytes = kind === "image" ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
  if (!allowed.has(file.type)) return { url: null, size: 0, error: kind === "image" ? "Yalnızca JPG, PNG veya WEBP yükleyin." : "Yalnızca PDF yükleyin." };
  if (file.size <= 0 || file.size > maxBytes) return { url: null, size: 0, error: `Dosya en fazla ${kind === "image" ? "8" : "15"} MB olabilir.` };

  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "pdf";
  const objectName = `${kind}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from("blog-media").upload(objectName, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) { reportBlogFailure("upload_media", error); return { url: null, size: 0, error: error.message }; }
    return { url: supabase.storage.from("blog-media").getPublicUrl(objectName).data.publicUrl, size: file.size, error: null };
  } catch (error) {
    reportBlogFailure("upload_media", error);
    return { url: null, size: 0, error: "Dosya yüklenemedi." };
  }
}

export async function updateAdminBlogPost(
  id: string,
  input: Partial<BlogPostInput>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data: userData } = await supabase.auth.getUser();
    const { content_json: inputContentJson, ...restInput } = input;
    const updatePayload: TablesUpdate<"blog_posts"> = { ...restInput };
    if (input.slug) updatePayload.slug = normalizeBlogSlug(input.slug);
    if (input.title) updatePayload.title = input.title.trim();
    if (input.excerpt !== undefined) updatePayload.excerpt = input.excerpt.trim() || (input.status === "draft" ? " " : "");
    if (input.content !== undefined) updatePayload.content = input.content || (input.status === "draft" ? " " : "");
    if (inputContentJson !== undefined) {
      updatePayload.content_json = (inputContentJson ?? null) as TablesUpdate<"blog_posts">["content_json"];
    }
    if (input.author_name !== undefined) updatePayload.author_name = input.author_name?.trim() || null;
    if (input.tags !== undefined) updatePayload.tags = parseBlogTags(input.tags);
    if (input.cover_image_url !== undefined) updatePayload.cover_image_url = input.cover_image_url?.trim() || null;
    // Auto-stamp published_at the first time a post is transitioned to published,
    // if the caller didn't explicitly supply one.
    if (input.status === "published" && !input.published_at) {
      updatePayload.published_at = publishNowStamp();
    }

    const { error } = await supabase.from("blog_posts").update(updatePayload).eq("id", id);
    if (error) {
      reportBlogFailure("update", error, id);
      if (error.code === "23505") return { success: false, error: "Bu dilde aynı slug'a sahip bir yazı zaten mevcut." };
      return { success: false, error: error.message };
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.blog.post_updated",
      entity_type: "blog_post",
      entity_id: id,
      metadata: { updates: Object.keys(input) },
    });

    return { success: true, error: null };
  } catch (error) {
    reportBlogFailure("update", error, id);
    return { success: false, error: "Güncelleme sırasında hata oluştu." };
  }
}

async function setAdminBlogArchiveState(
  id: string,
  archived: boolean
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const current = await getAdminBlogPost(id);
    if (current.error || !current.data) return { success: false, error: current.error || "Yazı bulunamadı." };
    if (archived === (current.data.status === "archived")) {
      return { success: false, error: archived ? "Yazı zaten arşivlenmiş." : "Yazı arşivde değil." };
    }

    const updatePayload: TablesUpdate<"blog_posts"> = archived
      ? { status: "archived" }
      : { status: "draft", published_at: null };
    const expectedStatus: BlogPostStatus = archived ? "archived" : "draft";
    const { data, error } = await supabase
      .from("blog_posts")
      .update(updatePayload)
      .eq("id", id)
      .eq("status", current.data.status)
      .select("id")
      .maybeSingle();
    if (error) { reportBlogFailure(archived ? "archive" : "restore", error, id); return { success: false, error: error.message }; }
    if (!data) {
      return {
        success: false,
        error: archived ? "Yazı bulunamadı veya zaten arşivlenmiş." : "Yazı bulunamadı veya arşivde değil.",
      };
    }

    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: archived ? "admin.blog.post_archived" : "admin.blog.post_restored",
      entity_type: "blog_post",
      entity_id: id,
      metadata: { previous_status: current.data.status, status: expectedStatus },
    });

    return { success: true, error: null };
  } catch (error) {
    reportBlogFailure(archived ? "archive" : "restore", error, id);
    return { success: false, error: archived ? "Arşivleme sırasında hata oluştu." : "Geri yükleme sırasında hata oluştu." };
  }
}

export async function archiveAdminBlogPost(id: string): Promise<{ success: boolean; error: string | null }> {
  return setAdminBlogArchiveState(id, true);
}

export async function restoreAdminBlogPost(id: string): Promise<{ success: boolean; error: string | null }> {
  return setAdminBlogArchiveState(id, false);
}
