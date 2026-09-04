import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database.types";
import type { BlogContentJson } from "@/lib/blog/blockSchema";

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
  status: BlogPostStatus;
  published_at?: string | null;
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
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "";
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
    // RLS already scopes to published + past published_at; this is a defensive
    // client-side re-check in case that ever changes.
    const now = Date.now();
    return (data || []).filter((post) => post.published_at && new Date(post.published_at).getTime() <= now);
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
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "";
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
    const post = data?.[0];
    if (!post || !post.published_at || new Date(post.published_at).getTime() > Date.now()) return null;
    return post;
  } catch {
    return null;
  }
}

/** Lists all posts (any status) for admin management. */
export async function listAdminBlogPosts(): Promise<{ data: BlogPostRow[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch {
    return { data: [], error: "Blog yazıları yüklenirken bir hata oluştu." };
  }
}

export async function getAdminBlogPost(id: string): Promise<{ data: BlogPostRow | null; error: string | null }> {
  try {
    const { data, error } = await getSupabaseClient().from("blog_posts").select("*").eq("id", id).single();
    return error ? { data: null, error: error.message } : { data, error: null };
  } catch {
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
      status: input.status,
      published_at: input.status === "published" ? input.published_at || publishNowStamp() : input.published_at || null,
    };

    const { data, error } = await supabase.from("blog_posts").insert(insertPayload).select().single();
    if (error) {
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
  } catch {
    return { data: null, error: "Yazı oluşturulurken bir hata oluştu." };
  }
}

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
    if (error) return { success: false, publishedAt: null, error: error.message };
    const result = data as { success?: boolean; published_at?: string; error_code?: string } | null;
    return result?.success
      ? { success: true, publishedAt: result.published_at || null, error: null }
      : { success: false, publishedAt: null, error: result?.error_code || "Yayın işlemi tamamlanamadı." };
  } catch {
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
    if (error) return { url: null, size: 0, error: error.message };
    return { url: supabase.storage.from("blog-media").getPublicUrl(objectName).data.publicUrl, size: file.size, error: null };
  } catch {
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
    if (input.cover_image_url !== undefined) updatePayload.cover_image_url = input.cover_image_url?.trim() || null;
    // Auto-stamp published_at the first time a post is transitioned to published,
    // if the caller didn't explicitly supply one.
    if (input.status === "published" && !input.published_at) {
      updatePayload.published_at = publishNowStamp();
    }

    const { error } = await supabase.from("blog_posts").update(updatePayload).eq("id", id);
    if (error) {
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
  } catch {
    return { success: false, error: "Güncelleme sırasında hata oluştu." };
  }
}

export async function deleteAdminBlogPost(id: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_user_id: userData.user?.id || null,
      action: "admin.blog.post_deleted",
      entity_type: "blog_post",
      entity_id: id,
      metadata: null,
    });

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Silme işlemi sırasında hata oluştu." };
  }
}
