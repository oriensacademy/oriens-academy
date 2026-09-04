"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { getAdminBlogPost, type BlogPostRow } from "@/lib/admin/blog";
import { localizedPath } from "@/lib/routes";
import { ArticleShell } from "@/components/blog/ArticleShell";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";

/**
 * Real article preview for a draft (spec §17): renders the exact same
 * ArticleShell the public site uses, fetched via the admin-authenticated
 * client so drafts/scheduled posts are visible here without being published.
 */
export function BlogPreviewPage() {
  const id = useSearchParams().get("id");
  const [post, setPost] = useState<BlogPostRow | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    void getAdminBlogPost(id).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !data) setError(loadError || "Yazı bulunamadı.");
      else setPost(data);
    });
    return () => { active = false; };
  }, [id]);

  if (!id || error) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-red-700">{error || "Önizlenecek yazı bulunamadı."}</p>
        <Link href="/admin/blog/" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <ArrowLeft className="size-3.5" />
          Blog listesine dön
        </Link>
      </div>
    );
  }

  if (!post) return <AdminWaveStatus label="Önizleme yükleniyor…" />;

  const locale = post.locale === "en" ? "en" : "tr";
  const articleUrl = `https://oriens-academy.com${localizedPath("blog", locale)}${post.slug}/`;

  return (
    <div>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
        <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" />Önizleme modu — bu, taslağın gerçek yayın görünümüdür ve yayınlanmamıştır.</span>
        <Link href={`/admin/blog/editor/?id=${post.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 hover:bg-amber-100">
          <ArrowLeft className="size-3.5" />
          Editöre dön
        </Link>
      </div>
      <ArticleShell post={post} locale={locale} articleUrl={articleUrl} />
    </div>
  );
}
