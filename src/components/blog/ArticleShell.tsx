import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import { blogPath } from "@/lib/routes";
import { renderBlogMarkdown } from "@/lib/blog/markdown";
import { sanitizeBlogContentJson } from "@/lib/blog/blockSchema";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import { BlogWhatsAppCta } from "@/components/blog/BlogWhatsAppCta";
import type { BlogPostRow } from "@/lib/admin/blog";

function formatDate(iso: string | null, locale: "tr" | "en"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * The article layout shared by the public blog detail page and the admin
 * draft preview (spec §16/§17) -- one rendering path, so what an author
 * previews is exactly what ships. Prefers the visual-editor `content_json`;
 * falls back to the legacy Markdown renderer for posts authored before V3.
 */
export function ArticleShell({ post, locale, articleUrl }: { post: BlogPostRow; locale: "tr" | "en"; articleUrl: string }) {
  const isTr = locale === "tr";
  const blocks = sanitizeBlogContentJson(post.content_json);

  return (
    <article className="bg-background pt-28 pb-24 md:pt-36">
      {post.cover_image_url ? (
        <div className="relative mx-auto mb-10 h-[260px] w-full max-w-[1100px] overflow-hidden rounded-[26px] bg-[#EFF4EE] px-0 sm:h-[360px] sm:px-6">
          <Image src={post.cover_image_url} alt="" fill sizes="100vw" className="object-cover sm:rounded-[26px]" priority />
        </div>
      ) : null}

      <div className="mx-auto max-w-[760px] px-6">
        <Link href={blogPath(locale)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" />
          {isTr ? "Blog'a Dön" : "Back to Blog"}
        </Link>

        <h1 className="mt-5 font-heading text-[clamp(2rem,4vw,2.75rem)] leading-[1.1] text-ink">{post.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDate(post.published_at, locale)}</span>
          {post.author_name ? <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />{post.author_name}</span> : null}
        </div>

        <div className="mt-8">{blocks ? <BlogArticleBody content={blocks} /> : renderBlogMarkdown(post.content)}</div>

        <BlogWhatsAppCta title={post.title} url={articleUrl} locale={locale} />

        <div className="mt-12 border-t border-border pt-6">
          <Link href={blogPath(locale)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="size-4" />
            {isTr ? "Tüm Yazılar" : "All Posts"}
          </Link>
        </div>
      </div>
    </article>
  );
}
