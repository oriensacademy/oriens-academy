"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { localizedPath, blogPath } from "@/lib/routes";
import { getPublicBlogPost, type BlogPostRow } from "@/lib/admin/blog";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { ArticleShell } from "@/components/blog/ArticleShell";

/**
 * Reads the actual slug from the browser URL. This page is served for every
 * /{locale}/blog/{slug}/ request via a Cloudflare Pages `_redirects` rewrite
 * (status 200) to this single static shell -- the URL bar keeps the pretty
 * slug, and we read it here since Next's static export can't pre-render an
 * unbounded set of slugs.
 */
function readSlugFromLocation(): string {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/blog/");
  if (parts.length < 2) return "";
  return decodeURIComponent(parts[1].replace(/\/$/, "").split("/")[0] || "");
}

export function BlogDetailPage() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const [slug] = useState<string>(() => readSlugFromLocation());
  const [post, setPost] = useState<BlogPostRow | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    getPublicBlogPost(locale, slug).then((row) => {
      if (!active) return;
      setPost(row);
    });
    return () => {
      active = false;
    };
  }, [locale, slug]);

  // Client-set metadata: a real, disclosed limitation of the static-export +
  // client-fetch architecture -- these are not present in the initial static
  // HTML payload, only after the post loads in the browser.
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | Oriens Academy Blog`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", post.excerpt);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `https://oriens-academy.com${localizedPath("blog", locale)}${post.slug}/`);
  }, [post, locale]);

  if (slug && post === null) {
    return (
      <section className="min-h-[60vh] bg-background pt-28 pb-20 md:pt-36">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="font-heading text-3xl text-ink">{isTr ? "Yazı bulunamadı" : "Post not found"}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {isTr ? "Aradığınız yazı yayından kaldırılmış veya taşınmış olabilir." : "The post you're looking for may have been removed or moved."}
          </p>
          <Link href={blogPath(locale)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-forest">
            <ArrowLeft className="size-4" />
            {isTr ? "Blog'a Dön" : "Back to Blog"}
          </Link>
        </div>
      </section>
    );
  }

  if (!post) return <AccountWaveLoader />;

  const articleUrl = `https://oriens-academy.com${localizedPath("blog", locale)}${post.slug}/`;
  return <ArticleShell post={post} locale={locale} articleUrl={articleUrl} />;
}
